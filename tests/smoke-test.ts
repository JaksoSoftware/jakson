import Koa from 'koa'
import axios from 'axios'
import Router from 'koa-router'

import { expect } from 'chai'
import {
  Config,
  ServiceFactory,
  Action,
  Application,
  Service,
  ServiceContext,
  Schemas
} from '../src/index'

describe('smoke tests', () => {
  interface User {
    id: number
    username: string
  }

  class UserService extends Service<App> {
    async getUser(userId: number): Promise<User> {
      const { fetch } = this.services
      return await fetch.fetchUser(userId)
    }

    async createUser(user: User): Promise<User> {
      return user
    }
  }

  class UserServiceFactory extends ServiceFactory<App, UserService> {
    async createService(ctx: ServiceContext<App>): Promise<UserService> {
      return new UserService(ctx)
    }
  }

  class FetchService extends Service<App> {
    async fetchUser(userId: number): Promise<User> {
      // Simulate some kind of async fetch from somewhere.
      await new Promise(resolve => setTimeout(resolve, 100))

      return {
        id: userId,
        username: 'jakso'
      }
    }
  }

  class FetchServiceFactory extends ServiceFactory<App, FetchService> {
    async createService(ctx: ServiceContext<App>): Promise<FetchService> {
      return new FetchService(ctx)
    }
  }

  interface ServiceFactories {
    user: UserServiceFactory
    fetch: FetchServiceFactory
  }

  type TestConfig = Config

  interface GetUserInput {
    id: number
  }

  class GetUserAction extends Action<App, GetUserInput, User> {
    static schemas: Schemas = {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer' }
        }
      },
      query: {
        type: 'object',
        properties: {
          withRoles: { type: 'boolean' }
        }
      }
    }

    protected parseInput(ctx: Koa.Context): GetUserInput {
      return {
        id: parseInt(ctx.params.id)
      }
    }

    protected async handle({ id }: GetUserInput): Promise<User> {
      const { user } = this.services
      return await user.getUser(id)
    }
  }

  class CreateUserAction extends Action<App, User, User> {
    static schemas: Schemas = {
      body: {
        type: 'object',
        required: ['id', 'username'],
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' }
        }
      }
    }

    protected parseInput(ctx: Koa.Context): User {
      return {
        id: ctx.request.body.id,
        username: ctx.request.body.id
      }
    }

    protected async handle(input: User): Promise<User> {
      const { user } = this.services
      return await user.createUser(input)
    }
  }

  class App extends Application<ServiceFactories, TestConfig> {
    async createServiceFactories(): Promise<ServiceFactories> {
      return {
        fetch: new FetchServiceFactory(this),
        user: new UserServiceFactory(this)
      }
    }

    async registerRoutes(router: Router): Promise<void> {
      router.get('/users/:id', GetUserAction.createHandler(this))
      router.post('/users', CreateUserAction.createHandler(this))
    }
  }

  let app: App
  const config: Config = {
    type: 'test',
    port: 3000
  }

  const request = axios.create({
    baseURL: `http://localhost:${config.port}/`,

    validateStatus() {
      return true
    }
  })

  before(async () => {
    app = new App(config)
    await app.configure()
    await app.start()
  })

  after(async () => {
    await app.stop()
  })

  it('an action should send a response on success', async () => {
    const res = await request.get('users/1')

    expect(res.status).to.equal(200)
    expect(res.data).to.eql({ id: 1, username: 'jakso' })
  })

  it('an action should return a validation error when an url parameter is invalid', async () => {
    const res = await request.get('users/notanumber')

    expect(res.status).to.equal(400)
    expect(res.data).to.eql({
      error: 'Validation',
      errors: [
        {
          keyword: 'type',
          dataPath: '.id',
          schemaPath: '#/properties/id/type',
          params: {
            type: 'integer'
          },
          message: 'should be integer'
        }
      ]
    })
  })

  it('an action should return a validation error when a query parameter is invalid', async () => {
    const res = await request.get('users/1', {
      params: {
        withRoles: 'not a boolean'
      }
    })

    expect(res.status).to.equal(400)
    expect(res.data).to.eql({
      error: 'Validation',
      errors: [
        {
          keyword: 'type',
          dataPath: '.withRoles',
          schemaPath: '#/properties/withRoles/type',
          params: {
            type: 'boolean'
          },
          message: 'should be boolean'
        }
      ]
    })
  })

  it('an action should return a validation error when the body is invalid', async () => {
    const res = await request.post('users', {
      id: 'not a number',
      username: 'New user'
    })

    expect(res.status).to.equal(400)
    expect(res.data).to.eql({
      error: 'Validation',
      errors: [
        {
          keyword: 'type',
          dataPath: '.id',
          schemaPath: '#/properties/id/type',
          params: {
            type: 'integer'
          },
          message: 'should be integer'
        }
      ]
    })
  })
})
