import winston from 'winston'
import { config } from './config'

interface LogContext {
  userId?: string
  requestId?: string
  method?: string
  path?: string
  statusCode?: number
  duration?: number
  error?: Error | string
  [key: string]: any
}

class Logger {
  private winston: winston.Logger

  constructor() {
    const isDevelopment = config.app.nodeEnv === 'development'
    
    this.winston = winston.createLogger({
      level: config.logging.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'tiktok-miner' },
      transports: [
        new winston.transports.Console({
          format: isDevelopment
            ? winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                  const metaString = Object.keys(meta).length 
                    ? `\n${JSON.stringify(meta, null, 2)}` 
                    : ''
                  return `${timestamp} ${level}: ${message}${metaString}`
                })
              )
            : winston.format.json(),
        }),
      ],
    })
  }

  private formatMessage(message: string, context?: LogContext): [string, LogContext] {
    const { error, ...meta } = context || {}
    
    if (error) {
      if (error instanceof Error) {
        meta.errorMessage = error.message
        meta.errorStack = error.stack
      } else {
        meta.errorMessage = String(error)
      }
    }
    
    return [message, meta]
  }

  debug(message: string, context?: LogContext): void {
    const [msg, meta] = this.formatMessage(message, context)
    this.winston.debug(msg, meta)
  }

  info(message: string, context?: LogContext): void {
    const [msg, meta] = this.formatMessage(message, context)
    this.winston.info(msg, meta)
  }

  warn(message: string, context?: LogContext): void {
    const [msg, meta] = this.formatMessage(message, context)
    this.winston.warn(msg, meta)
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = error instanceof Error 
      ? { ...context, error } 
      : { ...context, error: error ? String(error) : undefined }
    
    const [msg, meta] = this.formatMessage(message, errorContext)
    this.winston.error(msg, meta)
  }

  // Specialized logging methods
  http(req: { method: string; url: string }, res: { statusCode: number }, duration: number): void {
    this.info('HTTP Request', {
      method: req.method,
      path: req.url,
      statusCode: res.statusCode,
      duration,
    })
  }

  database(operation: string, duration: number, context?: LogContext): void {
    this.debug(`Database ${operation}`, { ...context, operation, duration })
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, { ...context, operation, duration })
  }
}

// Export singleton instance
export const logger = new Logger() 