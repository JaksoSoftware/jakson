import { Application } from './application'
import { ServiceFactory } from './service-factory'

export interface Constructor<T> {
  new (...args: any[]): T
}

/**
 * Extracts the service factories object type from an application type.
 */
export type GetServiceFactoriesType<T extends Application<any, any>> = T['TServiceFactories']

/**
 * Extracts the services object type from an application type.
 */
export type GetServicesType<T extends Application<any, any>> = T['TServices']

/**
 * Given a service factories object type, creates a corresponding services object type.
 */
export type GetServicesTypeForFactoriesType<T> = {
  [K in keyof T]: T[K] extends ServiceFactory<any, any> ? T[K]['TService'] : never
}

/**
 * Strip whitespace from the beginning of each line
 */
export function removeLeadingWhitespace(input: string): string {
  return input.replace(/^[^\S\n]+/gm, '')
}
