export interface BaseErrorArgs {
  message?: string
  cause?: Error
}

export class BaseError extends Error {
  private readonly cause?: any

  constructor({ message, cause }: BaseErrorArgs) {
    super(message || (cause && cause.message) || '')

    this.cause = cause
    const stack = this.stack

    Object.defineProperties(this, {
      stack: {
        get(): string | undefined {
          if (cause) {
            return `${stack}\nCaused by: ${cause.stack}`
          } else {
            return stack
          }
        }
      }
    })
  }

  get response(): any {
    return (this.cause && this.cause.response) || null
  }

  get responseData(): any {
    const response = this.response

    if (response) {
      return response.data
    } else {
      return null
    }
  }
}
