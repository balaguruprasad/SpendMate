// password flows wired (admin reset + self change); vendor admin hard-delete wired
import { buildApp } from './core/http/app.js'
import { config } from './core/config/index.js'
import { logger } from './core/logging/index.js'
import { closeDb } from './core/db/index.js'

const app = buildApp()
const server = app.listen(config.PORT, () => {
  logger.info(`SpendMate API listening on http://localhost:${config.PORT}`)
})

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down')
  server.close(() => {
    void closeDb().finally(() => process.exit(0))
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
