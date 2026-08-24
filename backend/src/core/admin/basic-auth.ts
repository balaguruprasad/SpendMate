import { timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'
import { config } from '../config/index.js'

/** True when both DOCS_USERNAME and DOCS_PASSWORD are configured. */
export function docsAuthConfigured(): boolean {
  return Boolean(config.DOCS_USERNAME && config.DOCS_PASSWORD)
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * HTTP Basic auth against DOCS_USERNAME / DOCS_PASSWORD.
 * - If creds aren't configured, `required` routes 404 (feature disabled) so nothing leaks.
 * - Comparison is timing-safe.
 */
export function basicAuth(realm = 'Restricted', required = true): RequestHandler {
  return (req, res, next) => {
    const user = config.DOCS_USERNAME
    const pass = config.DOCS_PASSWORD
    if (!user || !pass) {
      if (required) {
        res.status(404).type('text/plain').send('Not found')
        return
      }
      next()
      return
    }

    const header = req.headers.authorization
    if (header?.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
      const sep = decoded.indexOf(':')
      const u = sep >= 0 ? decoded.slice(0, sep) : decoded
      const p = sep >= 0 ? decoded.slice(sep + 1) : ''
      if (safeEqual(u, user) && safeEqual(p, pass)) {
        next()
        return
      }
    }
    res.set('WWW-Authenticate', `Basic realm="${realm}"`).status(401).type('text/plain').send('Authentication required')
  }
}
