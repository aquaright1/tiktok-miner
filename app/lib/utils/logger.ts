import { createLogger, format as winstonFormat, transports } from 'winston';
import { LOG_LEVEL } from '../config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

// Add colors to winston
transports.Console.prototype.colorize = function() {
  const format = this._format;
  this._format = format.combine(
    format.colorize({ colors: colors }),
    format
  );
  return this;
};

// Create format
const format = winstonFormat.combine(
  winstonFormat.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winstonFormat.colorize({ all: true }),
  winstonFormat.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create logger
const logger = createLogger({
  level: LOG_LEVEL,
  levels,
  format: winstonFormat.combine(
    winstonFormat.timestamp(),
    winstonFormat.json()
  ),
  transports: [
    new transports.Console({
      format: winstonFormat.combine(
        winstonFormat.colorize(),
        winstonFormat.simple()
      )
    })
  ]
});

// Helper functions for common logging patterns
export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};

export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logError = (message: string, meta?: any) => {
  logger.error(message, meta);
};

export default logger;
