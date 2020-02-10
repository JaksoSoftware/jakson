import Ajv from 'ajv'

import { Context } from 'koa'
import { Application } from './application'
import { NotFoundError } from './errors/not-found-error'
import { ForbiddenError } from './errors/forbidden-error'
import { UnauthorizedError } from './errors/unauthorized-error'
import { ConflictError } from './errors/conflict-error'
import { GetServicesType, Constructor } from './utils'
import { JSONSchema } from './json-schema'

export interface Result {
  status: number
  body: any
}

export interface Schemas {
  body?: JSONSchema
  params?: JSONSchema
  query?: JSONSchema
}

interface Validators {
  body?: BodyValidator
  params?: ParamsValidator
  query?: QueryValidator
}

type RouteHandler = (ctx: Context) => void

/**
 * An instance of an Action takes care of handling a single HTTP requests.
 *
 * To create a koa handler function that creates and executes an Action
 * instance for each request, you can call the static `createHandler`
 * method:
 *
 * ```ts
 * router.get('/users/:id', GetUserAction.createHandler(this))
 * ```
 */
export abstract class Action<TApplication extends Application<any, any>, InputType, OutputType> {
  /**
   * JSON schemas for request.body, ctx.params and ctx.query.
   */
  protected static schemas: Schemas = {}
  private static validators?: Validators

  protected app: TApplication
  protected services: GetServicesType<TApplication>

  constructor(app: TApplication, services: GetServicesType<TApplication>) {
    this.app = app
    this.services = services
    this.ensureValidatorsCreated()
  }

  /**
   * Creates and returns a koa request handler.
   */
  static createHandler<
    TAction extends Action<any, any, any>,
    TApplication extends Application<any, any>
  >(this: Constructor<TAction>, app: TApplication): RouteHandler {
    return async (ctx: Context): Promise<void> => {
      const services = await app.createServiceInstances('action', ctx)
      const action = new this(app, services)
      await action.run(ctx)
    }
  }

  /**
   * If the action has any inputs like route parameters, query parameters or
   * a request body, they need to be parsed from the koa context by overriding
   * this method.
   *
   * The koa context is not provided for the `handle` method, making it necessary
   * to parse the inputs in this method. This extra step forces you to use typed
   * inputs.
   */
  protected parseInput(ctx: Context): InputType {
    void ctx
    return {} as InputType
  }

  /**
   * Handle the request and return the request body.
   */
  protected abstract async handle(input: InputType): Promise<OutputType>

  /**
   * This method is called last and handles how we respond to the request.
   *
   * The default implementation simply sets the result of the `handle` method
   * as the body and status to 200. You don't usually need to override this.
   */
  protected respond(ctx: Context, result: Result): void {
    ctx.status = result.status
    ctx.body = result.body
  }

  /**
   * Validates the input.
   *
   * Returns a `Result` instance with the error status and data
   * or null if validation succeeded.
   */
  protected async validate(ctx: Context): Promise<Result | null> {
    const validators = this.ctor.validators!
    let result: Result | null = null

    if (validators.body) {
      result = validators.body.validate(ctx)
    }

    if (!result && validators.params) {
      result = validators.params.validate(ctx)
    }

    if (!result && validators.query) {
      result = validators.query.validate(ctx)
    }

    return result
  }

  protected log(message: string, data?: object): void {
    this.app.log(message, data)
  }

  protected async beforeHandle(input: InputType): Promise<InputType> {
    return input
  }

  protected async afterHandle(input: InputType, output: OutputType): Promise<OutputType> {
    void input
    return output
  }

  protected async beforeStopServices(): Promise<void> {
    // Do nothing by default.
  }

  protected async afterStopServices(): Promise<void> {
    // Do nothing by default.
  }

  protected handleError(error: any): Result {
    if (error instanceof NotFoundError) {
      return {
        status: 404,
        body: {
          error: 'NotFound'
        }
      }
    } else if (error instanceof UnauthorizedError) {
      return {
        status: 401,
        body: {
          error: 'Unauthorized'
        }
      }
    } else if (error instanceof ForbiddenError) {
      return {
        status: 403,
        body: {
          error: 'Forbidden'
        }
      }
    } else if (error instanceof ConflictError) {
      return {
        status: 409,
        body: {
          error: 'Conflict'
        }
      }
    } else {
      this.log('error', { error })

      return {
        status: 500,
        body: {
          error: 'Internal'
        }
      }
    }
  }

  private async run(ctx: Context): Promise<void> {
    const requestStartTime = Date.now()
    const { method, path } = ctx.request

    let result: Result

    try {
      await this.app.startServiceInstances(this.services)

      // Log only after `startServiceInstances` has been called so that
      // `log` method itself can use services if overridden.
      this.log('request started', { method, path })

      const validationResult = await this.validate(ctx)

      if (validationResult) {
        result = validationResult
        return
      }

      let input = this.parseInput(ctx)
      input = await this.beforeHandle(this.parseInput(ctx))

      let output = await this.handle(input)
      output = await this.afterHandle(input, output)

      if (output && !isPlainDto(output)) {
        throw new Error('always return plain objects (DTOs)')
      }

      result = {
        status: 200,
        body: output
      }
    } catch (err) {
      result = this.handleError(err)
    } finally {
      this.handleResult(ctx, result!)

      // Log before `stopServiceInstances` is called so that
      // `log` method can use services if overridden.
      this.log('request ended', {
        status: result!.status,
        requestTime: Date.now() - requestStartTime
      })

      await this.beforeStopServices()
      await this.app.stopServiceInstances(this.services)
      await this.afterStopServices()
    }
  }

  private get ctor(): typeof Action {
    return this.constructor as typeof Action
  }

  private ensureValidatorsCreated(): void {
    const { schemas } = this.ctor
    let { validators } = this.ctor

    if (!validators) {
      validators = {}
      this.ctor.validators = validators

      if (!schemas) {
        return
      }

      if (schemas.body) {
        validators.body = new BodyValidator(schemas.body)
      }

      if (schemas.params) {
        validators.params = new ParamsValidator(schemas.params)
      }

      if (schemas.query) {
        validators.query = new QueryValidator(schemas.query)
      }
    }
  }

  private handleResult(ctx: Context, result: Result): void {
    if (result.status >= 200 && result.status < 300) {
      this.respond(ctx, result)
    } else {
      ctx.status = result.status
      ctx.body = result.body
    }
  }
}

abstract class ValidatorBase {
  protected static ajv: Ajv.Ajv
  private readonly validator: Ajv.ValidateFunction

  constructor(schema: JSONSchema) {
    if (!this.ctor.ajv) {
      this.ctor.ajv = this.createAjv()
    }

    this.validator = this.ctor.ajv.compile(schema)
  }

  private get ctor(): typeof ValidatorBase {
    return this.constructor as typeof ValidatorBase
  }

  protected abstract createAjv(): Ajv.Ajv
  protected abstract getValue(ctx: Context): any

  validate(ctx: Context): Result | null {
    if (this.validator(this.getValue(ctx)) !== true) {
      return {
        status: 400,
        body: {
          error: 'Validation',
          errors: this.validator.errors
        }
      }
    }

    return null
  }
}

abstract class Validator extends ValidatorBase {
  protected createAjv(): Ajv.Ajv {
    return new Ajv({ allErrors: true, format: 'full' })
  }
}

abstract class CoercingValidator extends ValidatorBase {
  protected createAjv(): Ajv.Ajv {
    return new Ajv({
      allErrors: true,
      coerceTypes: true,
      format: 'full'
    })
  }
}

class BodyValidator extends Validator {
  getValue(ctx: Context): any {
    return ctx.request.body
  }
}

class ParamsValidator extends CoercingValidator {
  getValue(ctx: Context): any {
    return ctx.params
  }
}

class QueryValidator extends CoercingValidator {
  getValue(ctx: Context): any {
    return ctx.query
  }
}

function isPlainDto(obj: any): boolean {
  if (Array.isArray(obj)) {
    return obj.every(isPlainDto)
  } else if (typeof obj === 'object') {
    return obj.toJSON === undefined
  } else {
    return true
  }
}
