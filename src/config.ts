export type ConfigType = 'development' | 'test' | 'integration-test' | 'staging' | 'production'

export interface Config {
  type: ConfigType
  port: number
}
