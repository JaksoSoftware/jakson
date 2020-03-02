#!/usr/bin/env node

import program, { CommanderStatic } from 'commander'
import { execSync } from 'child_process'
import { removeLeadingWhitespace } from './utils'
import fs from 'fs'

interface Options {
  name: string
  author?: string
  database?: string
}

function main(): void {
  program
    .option('-n, --name <name>', 'name of the project')
    .option('-a, --author <author>', 'author of the project')
    .option('-d, --database <database>', 'add database to the app')
    .parse(process.argv)

  const options = readOptions(program)

  console.log('creating files')

  for (const dir of [
    'src',
    'src/actions',
    'src/actions/health',
    'src/services',
    'src/services/health',
    'src/configs',
    'tests',
    'tests/health'
  ]) {
    fs.mkdirSync(dir)
  }

  if (options.database) {
    fs.mkdirSync('src/services/db')
    fs.mkdirSync('migrations')
  }

  for (const { file, create } of [
    { file: 'package.json', create: createPackageJson },
    { file: 'tsconfig.json', create: createTsConfigJson },
    { file: 'tsconfig-eslint.json', create: createTsConfigEslintJson },
    { file: '.eslintrc.js', create: createEslintRc },
    { file: '.prettierrc.json', create: createPrettierRc },
    { file: '.lintstagedrc.js', create: createLintStagedRc },
    { file: '.gitignore', create: createGitIgnore },
    { file: 'src/config.ts', create: createConfig },
    { file: 'src/configs/development.ts', create: createDevelopmentConfig },
    { file: 'src/configs/test.ts', create: createTestConfig },
    { file: 'src/configs/integration-test.ts', create: createIntegrationTestConfig },
    { file: 'src/configs/staging.ts', create: createStagingConfig },
    { file: 'src/configs/production.ts', create: createProductionConfig },
    { file: 'src/action.ts', create: createAction },
    { file: 'src/services/health/health-service.ts', create: createHealthService },
    { file: 'src/services/health/health-service-factory.ts', create: createHealthServiceFactory },
    { file: 'src/actions/health/get-health-action.ts', create: createGetHealthAction },
    { file: 'src/app.ts', create: createApp },
    { file: 'tests/test-session.ts', create: createTestSession },
    { file: 'tests/health/get-health-test.ts', create: createGetHealthTest }
  ]) {
    fs.writeFileSync(file, create(options))
  }

  if (options.database) {
    for (const { file, create } of [
      { file: 'knexfile.js', create: createKnexFile },
      { file: 'knexfile.d.ts', create: createKnexFileTypings },
      { file: 'src/services/db/db-service-factory.ts', create: createDbServiceFactory },
      { file: 'docker-compose.yml', create: createDockerComposeFile }
    ]) {
      fs.writeFileSync(file, create(options))
    }
  }

  console.log('running npm install')
  execSync('npm install')

  console.log('running prettier')
  execSync("npx prettier --write '**/*.{ts,js,json}'")
}

function readOptions(program: CommanderStatic): Options {
  const rawOptions = program.opts()

  // For some reason, commander has a special case for `name` and `description`.
  for (const option of ['name', 'description']) {
    if (typeof rawOptions[option] === 'function') {
      delete rawOptions[option]
    }
  }

  if (!rawOptions.name) {
    console.error("error: required option '-n, --name <name>' not specified")
    process.exit(1)
  }

  if (!rawOptions.database) {
    rawOptions.database = ''
  }

  return rawOptions as Options
}

function createPackageJson(options: Options): string {
  const packageJson: any = {
    name: options.name,
    description: options.name,
    private: true,
    version: '0.1.0',
    main: 'lib/main.js',

    scripts: {
      test: 'mocha --timeout 600000 -r ts-node/register tests/**/*-test.ts',
      clean: 'rm -rf lib',
      build: 'npm run clean && tsc',
      eslint: 'eslint --ext .ts src/ tests/',
      'eslint:fix': 'eslint --fix --ext .ts src/ tests/'
    },

    author: options.author || 'Unknown',
    license: 'UNLICENSED',
    files: ['lib/*'],

    devDependencies: {
      '@types/chai': '^4.2.7',
      '@types/mocha': '^5.2.7',
      '@types/koa': '^2.11.0',
      '@types/koa-router': '^7.0.42',
      '@typescript-eslint/eslint-plugin': '^2.19.0',
      '@typescript-eslint/parser': '^2.19.0',
      axios: '^0.19.0',
      chai: '^4.2.0',
      eslint: '^6.8.0',
      'eslint-config-prettier': '^6.10.0',
      'eslint-plugin-prettier': '^3.1.2',
      'lint-staged': '^10.0.7',
      mocha: '^6.2.2',
      prettier: '^1.19.1',
      'ts-node': '^8.5.4',
      typescript: '^3.7.4'
    },

    dependencies: {
      dotenv: '^8.2.0',
      jakson: `*`
    }
  }

  if (options.database) {
    packageJson.dependencies.pg = '^7.15.1'
    packageJson.dependencies.knex = '^0.20.4'
    packageJson.dependencies.objection = '^2.0.7'
    packageJson.dependencies['jakson-postgres'] = '*'
  }

  return jsonToFile(packageJson)
}

const baseTsConfig = {
  compilerOptions: {
    target: 'ESNext',
    module: 'commonjs',
    declaration: true,
    outDir: 'lib',
    strict: true,
    esModuleInterop: true,
    noImplicitAny: true
  }
}

function createTsConfigJson(): string {
  const tsConfig = {
    ...baseTsConfig,
    include: ['src/']
  }

  return jsonToFile(tsConfig)
}

function createTsConfigEslintJson(): string {
  return jsonToFile(baseTsConfig)
}

function createGitIgnore(): string {
  return removeLeadingWhitespace(`
    node_modules/
    .vscode/
    lib/
    *.iml
    .idea/
  `)
}

function createConfig(options: Options): string {
  return `
    import { Config as ConfigBase } from 'jakson'
    ${options.database && "import { PostgresServiceConfig } from 'jakson-postgres'"}

    export interface Config extends ConfigBase {
      ${options.database && 'db:  PostgresServiceConfig'}
    }
  `
}

function createDevelopmentConfig(options: Options): string {
  return `
    require('dotenv').config()

    import { Config } from '../config'
    ${options.database && "import { development as knex } from '../../knexfile'"}

    const config: Config = {
      type: 'development',
      port: 3000
      ${options.database && ',db: { knex }'}
    }

    export default config
  `
}

function createTestConfig(options: Options): string {
  return `
    import devConfig from './development'

    import { Config } from '../config'
    ${options.database && "import { test as knex } from '../../knexfile'"}

    const config: Config = {
      ...devConfig,

      type: 'test',
      port: 3001
      ${options.database && ',db: { knex }'}
    }

    export default config
  `
}

function createIntegrationTestConfig(options: Options): string {
  return `
    import devConfig from './development'

    import { Config } from '../config'
    ${options.database && "import { integration_test as knex } from '../../knexfile'"}

    const config: Config = {
      ...devConfig,

      type: 'integration-test',
      port: 3002
      ${options.database && ',db: { knex }'}
    }

    export default config
  `
}

function createStagingConfig(options: Options): string {
  return `
    import devConfig from './development'

    import { Config } from '../config'
    ${options.database && "import { staging as knex } from '../../knexfile'"}

    const config: Config = {
      ...devConfig,

      type: 'staging',
      port: 3003
      ${options.database && ',db: { knex }'}
    }

    export default config
  `
}

function createProductionConfig(options: Options): string {
  return `
    import devConfig from './development'

    import { Config } from '../config'
    ${options.database && "import { production as knex } from '../../knexfile'"}

    const config: Config = {
      ...devConfig,

      type: 'production',
      port: 3004
      ${options.database && ',db: { knex }'}
    }

    export default config
  `
}

function createAction(): string {
  return `
    import { Action as ActionBase } from 'jakson'
    import { App } from './app'

    export abstract class Action<InputType, OutputType> extends ActionBase<
      App,
      InputType,
      OutputType
    > {

    }
  `
}

function createHealthService(options: Options): string {
  let code = 'return true'

  if (options.database) {
    code = `
      const { knex } = this.services.db

      // This will throw if the db connection is not ok.
      await knex.raw('select 1')
      return true
    `
  }

  return `
    import { Service } from 'jakson'
    import { App } from '../../app'

    export class HealthService extends Service<App> {
      async getHealth(): Promise<boolean> {
        ${code}
      }
    }
  `
}

function createHealthServiceFactory(): string {
  return `
    import { ServiceFactory, ServiceContext } from 'jakson'
    import { HealthService } from './health-service'
    import { App } from '../../app'

    export class HealthServiceFactory extends ServiceFactory<App, HealthService> {
      async createService(ctx: ServiceContext<App>): Promise<HealthService> {
        return new HealthService(ctx)
      }
    }
  `
}

function createGetHealthAction(): string {
  return `
    import { Action } from '../../action'

    interface HealthResponse {
      isHealthy: boolean
    }

    export class GetHealthAction extends Action<void, HealthResponse> {
      protected async handle(): Promise<HealthResponse> {
        const { health } = this.services

        return {
          isHealthy: await health.getHealth()
        }
      }
    }
  `
}

function createApp(options: Options): string {
  return `
    import Router from 'koa-router'

    import { Application } from 'jakson'
    import { Config } from './config'

    import { GetHealthAction } from './actions/health/get-health-action'
    import { HealthServiceFactory } from './services/health/health-service-factory'
    ${options.database && "import { DbServiceFactory } from './services/db/db-service-factory'"}

    interface ServiceFactories {
      ${options.database && 'db: DbServiceFactory'}
      health: HealthServiceFactory
    }

    export class App extends Application<ServiceFactories, Config> {
      async createServiceFactories(): Promise<ServiceFactories> {
        return {
          ${options.database && 'db: new DbServiceFactory(this),'}
          health: new HealthServiceFactory(this)
        }
      }

      async registerRoutes(router: Router): Promise<void> {
        router.get('/health', GetHealthAction.createHandler(this))
      }
    }
  `
}

function createTestSession(options: Options): string {
  void options
  return `
    import { App } from '../src/app'

    import axios from 'axios'
    import testConfig from '../src/configs/test'

    export const app = new App(testConfig)

    export const request = axios.create({
      baseURL: \`http://localhost:\${testConfig.port}/\`,

      validateStatus() {
        return true
      }
    })

    before(async () => {
      await app.configure()
    })

    before(async () => {
      await app.forEachServiceFactory(async (_, factory) => {
        await factory.testSession.beforeStartApp()
      })
    })

    before(async () => {
      await app.start()
    })

    before(async () => {
      await app.forEachServiceFactory(async (_, factory) => {
        await factory.testSession.afterStartApp()
      })
    })

    beforeEach(async () => {
      await app.forEachServiceFactory(async (_, factory) => {
        await factory.testSession.beforeEachTest()
      })
    })

    afterEach(async () => {
      await app.forEachServiceFactory(async (_, factory) => {
        await factory.testSession.afterEachTest()
      })
    })

    after(async () => {
      await app.forEachServiceFactory(async (_, factory) => {
        await factory.testSession.beforeStopApp()
      })
    })

    after(async () => {
      await app.stop()
    })

    after(async () => {
      await app.forEachServiceFactory(async (_, factory) => {
        await factory.testSession.afterStopApp()
      })
    })
  `
}

function createGetHealthTest(): string {
  return `
    import { expect } from 'chai'
    import { request } from '../test-session'

    describe('GET /health', () => {
      it('should respond with 200', async () => {
        const res = await request.get('/health')

        expect(res.status).to.equal(200)
        expect(res.data).to.eql({ isHealthy: true })
      })
    })
  `
}

function createDbServiceFactory(): string {
  return `
    import { App } from '../../app'
    import { PostgresServiceFactory, PostgresServiceConfig } from 'jakson-postgres'

    export class DbServiceFactory extends  PostgresServiceFactory<App> {
      get config(): PostgresServiceConfig {
        return this.app.config.db
      }
    }
  `
}

function createKnexFile(options: Options): string {
  const database = options.database!.replace(/-/g, '_')

  return `
    require('dotenv').config()

    const { env } = process

    const connection = {
      host: env.POSTGRES_HOST || 'localhost',
      port: env.POSTGRES_PORT || 5432,
      user: env.POSTGRES_USER || 'postgres',
      password: env.POSTGRES_PASSWORD || '',
    }

    const pool = {
      min: 0,
      max: 10
    }

    module.exports = {
      development: {
        client: 'postgresql',

        connection: {
          ...connection,
          database: '${database + '_development'}'
        },

        pool
      },

      test: {
        client: 'postgresql',

        connection: {
          ...connection,
          database: '${database + '_test'}'
        },

        pool
      },

      integration_test: {
        client: 'postgresql',

        connection: {
          ...connection,
          database: '${database + '_integration_test'}'
        },

        pool
      },

      staging: {
        client: 'postgresql',

        connection: {
          ...connection,
          database: '${database + '_staging'}'
        },

        pool
      },

      production: {
        client: 'postgresql',

        connection: {
          ...connection,
          database: '${database + '_production'}'
        },

        pool
      }
    }
  `
}

function createKnexFileTypings(): string {
  return `
    import Knex from 'knex'

    declare const development: Knex.Config
    declare const test: Knex.Config
    declare const integration_test: Knex.Config
    declare const staging: Knex.Config
    declare const production: Knex.Config
  `
}

function createDockerComposeFile(options: Options): string {
  const name = options.name.replace(/_/g, '-')

  return `
    version: '3'
    services:
      postgres:
        image: 'postgres:11'
        container_name: '${name}-postgres-dev'
        command: postgres -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c random_page_cost=1.0
        ports:
          - '5432:5432'
  `
}

function createEslintRc(): string {
  return `
    module.exports = {
      parser: '@typescript-eslint/parser',  // Specifies the ESLint parser
      extends: [
        'plugin:@typescript-eslint/recommended',  // Uses the recommended rules from the @typescript-eslint/eslint-plugin
        'prettier/@typescript-eslint',  // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
        'plugin:prettier/recommended',  // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
      ],
      parserOptions: {
        ecmaVersion: 2018,  // Allows for the parsing of modern ECMAScript features
        sourceType: 'module',  // Allows for the use of imports,
        project: ['tsconfig-eslint.json'],
        noWatch: true
      },
      rules: {
        // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
        // e.g. "@typescript-eslint/explicit-function-return-type": "off",
        '@typescript-eslint/member-delimiter-style': [
          'error', {
            multiline: {
              delimiter: 'none'
            }
          }
        ],
        '@typescript-eslint/camelcase': [
          'error', {
            properties: 'never'
          }
        ],
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-use-before-define': ["error", { "functions": false, "classes": false }],
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/prefer-readonly': 'warn'
      }
    }
  `
}

function createPrettierRc(): string {
  const prettierRc = {
    printWidth: 100,
    semi: false,
    singleQuote: true
  }

  return jsonToFile(prettierRc)
}

function createLintStagedRc(): string {
  return `
    module.exports = {
      '**/*.ts': [
        () => 'tsc --noEmit',
        'eslint --max-warnings=0'
      ]
    }
  `
}

function jsonToFile(value: any): string {
  return JSON.stringify(value, null, 2) + '\n'
}

main()
