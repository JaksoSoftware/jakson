import { Application } from './application'
import { GetServicesType } from './utils'
import { Config } from './config'

export interface ServiceContext<TApplication extends Application<any, Config>> {
  app: TApplication
  services: GetServicesType<TApplication>
  uid: string
  type: string
}

export class Service<TApplication extends Application<any, Config>> {
  protected app: TApplication
  protected services: GetServicesType<TApplication>
  protected instanceId: string

  constructor(ctx: ServiceContext<TApplication>) {
    this.app = ctx.app
    this.services = ctx.services
    this.instanceId = ctx.uid
  }

  /**
   * This is called once when an instance of this service is created for a request,
   * task or a test.
   */
  async start(): Promise<void> {
    // Do nothing by default.
  }

  /**
   * This is called once when the request, task or a test has finished using
   * this service.
   */
  async stop(): Promise<void> {
    // Do nothing by default.
  }
}
