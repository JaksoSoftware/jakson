export class ServiceTestSession {
  async beforeStartApp(): Promise<void> {
    // Do nothing by default.
  }

  async afterStartApp(): Promise<void> {
    // Do nothing by default.
  }

  async beforeEachTest(): Promise<void> {
    // Do nothing by default.
  }

  async afterEachTest(): Promise<void> {
    // Do nothing by default.
  }

  async beforeStopApp(): Promise<void> {
    // Do nothing by default.
  }

  async afterStopApp(): Promise<void> {
    // Do nothing by default.
  }
}
