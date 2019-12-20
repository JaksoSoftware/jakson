import { Application } from './application'
import { Service, ServiceContext } from './service'
import { ServiceTestSession } from './service-test-session'
import { Config } from './config'

/**
 * ServiceFactory is alive throughout the app's lifetime. It's responsible for creating
 * a service instance for each request, task etc.
 *
 * Any heavy initialization code, or stuff that only should be done once, should be
 * implemented in the factory.
 */
export abstract class ServiceFactory<
  TApplication extends Application<any, Config>,
  TService extends Service<TApplication>
> {
  TService!: TService

  protected app: TApplication
  private _testSession?: ServiceTestSession

  constructor(app: TApplication) {
    this.app = app
  }

  /**
   * Returns the test session for the service.
   */
  get testSession(): ServiceTestSession {
    if (!this._testSession) {
      this._testSession = this.createTestSession()
    }

    return this._testSession
  }

  /**
   * This is called once when the app is started.
   */
  async start(): Promise<void> {
    // Do nothing by default.
  }

  /**
   * This is called once when the app is stopped.
   */
  async stop(): Promise<void> {
    // Do nothing by default.
  }

  /**
   * Creates a new service instance. This is called for each request, task etc.
   */
  abstract async createService(ctx: ServiceContext<TApplication>): Promise<TService>

  /**
   * Creates a test session.
   *
   * This is only called in the tests.
   */
  protected createTestSession(): ServiceTestSession {
    return new ServiceTestSession()
  }
}
