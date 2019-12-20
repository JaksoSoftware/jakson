import Koa from 'koa'
import http from 'http'
import Router from 'koa-router'
import nanoid from 'nanoid'
import bodyParser from 'koa-bodyparser'

import { Server } from 'net'
import { Config } from './config'
import { ServiceFactory } from './service-factory'
import { GetServicesTypeForFactoriesType, GetServicesType, GetServiceFactoriesType } from './utils'
import { ServiceContext, Service } from './service'

export abstract class Application<TServiceFactories, TConfig extends Config> {
  TServiceFactories!: TServiceFactories
  TServices!: GetServicesTypeForFactoriesType<TServiceFactories>

  config: TConfig
  private router: Router

  // These exist after the async configure phase but not yet
  // in the constructor.
  koa!: Koa
  serviceFactories!: TServiceFactories

  // This exists after the app has been started.
  private server?: Server

  constructor(config: TConfig) {
    this.config = config
    this.router = new Router()
  }

  async configure() {
    this.serviceFactories = await this.createServiceFactories()
    await this.typeCheckServiceFactories()

    await this.registerRoutes(this.router)
    this.koa = await this.createKoa()
  }

  async start() {
    if (!this.serviceFactories) {
      throw new Error('run `await app.configure()` before `await app.start()`')
    }

    await this.startServiceFactories()
    this.server = await this.startServer(this.koa)
  }

  async stop() {
    if (this.server) {
      await this.stopServer(this.server)
    }

    await this.stopServiceFactories()
  }

  async createServiceInstances(type: string, koaCtx?: Koa.Context): Promise<GetServicesType<this>> {
    const services: any = {}
    const serviceContext = await this.createServiceContext(type, services, koaCtx)

    return await this.createServiceInstancesForContext(serviceContext, services)
  }

  async startServiceInstances(services: GetServicesType<this>): Promise<void> {
    await this.forEachService(services, async (_, service): Promise<void> => service.start())
  }

  async stopServiceInstances(services: GetServicesType<this>): Promise<void> {
    await this.forEachService(services, async (_, service): Promise<void> => service.stop())
  }

  async forEachServiceFactory(
    callback: (
      name: keyof GetServiceFactoriesType<this>,
      factory: ServiceFactory<this, Service<this>>
    ) => Promise<void>
  ): Promise<void> {
    for (const [name, factory] of Object.entries(this.serviceFactories) as [
      keyof GetServiceFactoriesType<this>,
      ServiceFactory<this, Service<this>>
    ][]) {
      await callback(name, factory)
    }
  }

  async forEachService(
    services: GetServicesType<this>,
    callback: (name: keyof GetServicesType<this>, service: Service<this>) => Promise<void>
  ) {
    for (const [name, service] of Object.entries(services) as [
      keyof GetServicesType<this>,
      Service<this>
    ][]) {
      await callback(name, service)
    }
  }

  abstract async createServiceFactories(): Promise<TServiceFactories>
  abstract async registerRoutes(router: Router): Promise<void>

  log(message: string, data?: object): void {
    console.log(message, data)
  }

  protected async createKoa(): Promise<Koa> {
    const koa = new Koa()

    await this.beforeKoaConfigured(koa)

    koa.use(bodyParser())

    await this.afterKoaBodyParserAdded(koa)

    koa.use(this.router.routes())
    koa.use(this.router.allowedMethods())

    await this.afterKoaConfigured(koa)

    return koa
  }

  protected async beforeKoaConfigured(koa: Koa): Promise<void> {
    // Do nothing by default.
  }

  protected async afterKoaBodyParserAdded(koa: Koa): Promise<void> {
    // Do nothing by default.
  }

  protected async afterKoaConfigured(koa: Koa): Promise<void> {
    // Do nothing by default.
  }

  protected async startServer(koa: Koa): Promise<Server> {
    const server = http.createServer(koa.callback())
    await new Promise(resolve => server.listen(this.config.port, resolve))
    return server
  }

  protected async stopServer(server: Server): Promise<void> {
    await new Promise(resolve => server.close(resolve))
  }

  private async typeCheckServiceFactories() {
    // There doesn't seem to be an easy way to force the TServiceFactories
    // interface values to have type ServiceFactory<this, any> while making
    // the GetServicesTypeForFactoriesType magic possible. Instead, we have
    // this runtime check.
    this.forEachServiceFactory(
      async (_, factory): Promise<void> => {
        if (!(factory instanceof ServiceFactory)) {
          throw new Error(`${name} is not an instance of ServiceFactory`)
        }
      }
    )
  }

  private async startServiceFactories(): Promise<void> {
    await this.forEachServiceFactory(async (_, factory) => factory.start())
  }

  private async stopServiceFactories(): Promise<void> {
    await this.forEachServiceFactory(async (_, factory) => factory.stop())
  }

  protected async createServiceContext(
    type: string,
    services: GetServicesType<this>,
    koaCtx?: Koa.Context
  ): Promise<ServiceContext<this>> {
    void koaCtx

    return {
      app: this,
      services,
      uid: nanoid(8),
      type
    }
  }

  private async createServiceInstancesForContext(
    serviceContext: ServiceContext<this>,
    services: any
  ): Promise<GetServicesType<this>> {
    await this.forEachServiceFactory(async (name, factory) => {
      services[name] = await factory.createService(serviceContext)
    })

    return services
  }
}
