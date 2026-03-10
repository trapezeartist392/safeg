const winston = require('winston');
const { combine, timestamp, printf, colorize, errors } = winston.format;
const fmt = printf(({ level, message, timestamp, stack }) =>
  `${timestamp} [${level}]: ${stack || message}`);
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), fmt),
  transports: [
    new winston.transports.Console({ format: combine(colorize(), fmt) }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
module.exports = logger;
