import { pino } from 'pino'
import { config } from '../config/index.js'

// Dev: clean, colorized, single-line logs (the per-request line is built by pino-http in app.ts,
// so we hide the verbose req/res/responseTime objects here). Production: structured JSON (queryable).
export const logger = pino({
  level: config.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.passwordHash', '*.password'],
  ...(config.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            singleLine: true,
            ignore: 'pid,hostname,req,res,responseTime,reqId,context',
          },
        },
      }
    : {}),
})
