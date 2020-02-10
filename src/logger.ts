import util from 'util'

export interface Logger {
  (message: string, data?: any): void
}

export interface LogData {
  error?: any
  [key: string]: any
}

export function createLogger(tag: string): Logger {
  return (message: string, data: LogData = {}): void => {
    const { error, ...restData } = data
    const logFunc = console[error ? 'error' : 'log'].bind(console)
    const dataStr = util.inspect(restData)

    logFunc(`${tag}: ${message} ${dataStr !== '{}' ? dataStr : ''}`)

    if (error) {
      console.error(error.stack)

      // Log the response data of an axios error.
      if (error.response) {
        console.error('status:', error.response.status)
        console.error('data:', util.inspect(error.response.data, { depth: null }))
      }
    }
  }
}
