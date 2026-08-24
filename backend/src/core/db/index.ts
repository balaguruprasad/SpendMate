import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { ConnectionOptions } from 'node:tls'
import { config } from '../config/index.js'
import { logger } from '../logging/index.js'
import type { DB } from './types.js'

const { Pool } = pg

function isLocalHost(url: string): boolean {
  try {
    const h = new URL(url).hostname
    return h === 'localhost' || h === '127.0.0.1' || h === '::1'
  } catch {
    return false
  }
}

// SSL for remote DBs only. A local Postgres has no TLS, so never negotiate it there even if
// DB_SSL is left on — this lets the same .env target local dev or the remote without edits.
const useSsl =
  (config.DB_SSL || config.DATABASE_URL.includes('sslmode=')) && !isLocalHost(config.DATABASE_URL)

// The latest `pg` interprets `sslmode=require` in the URL as verify-full, which fails against a
// public-IP managed DB with no local CA. Strip sslmode so the explicit `ssl` object below governs
// TLS for the app pool. (Prisma's CLI engine still reads sslmode from DATABASE_URL for migrations.)
function poolConnectionString(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.delete('sslmode')
    u.searchParams.delete('uselibpqcompat')
    return u.toString()
  } catch {
    return url
  }
}

/**
 * Secure by default: when a CA cert is provided, verify against it (full TLS).
 * Without a CA, verification stays ON unless DB_SSL_NO_VERIFY is explicitly set — and
 * we log a loud warning, because skipping verification exposes the connection to MITM.
 */
function sslConfig(): ConnectionOptions | undefined {
  if (!useSsl) return undefined
  if (config.DB_CA_CERT) return { ca: config.DB_CA_CERT, rejectUnauthorized: true }
  if (config.DB_SSL_NO_VERIFY) {
    logger.warn('DB TLS certificate verification is DISABLED (DB_SSL_NO_VERIFY). Provide DB_CA_CERT in production.')
    return { rejectUnauthorized: false }
  }
  return { rejectUnauthorized: true }
}

const pool = new Pool({
  connectionString: poolConnectionString(config.DATABASE_URL),
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
  keepAlive: true, // keep TCP alive so a managed DB (Cloud SQL) doesn't silently drop idle sockets
  ...(useSsl ? { ssl: sslConfig() } : {}),
})

// A managed DB can close an idle pooled connection from its side. Without this handler the
// resulting client 'error' is unhandled and can crash the process — log it and let the pool
// discard the dead connection so the next query transparently gets a fresh one.
pool.on('error', (err) => {
  logger.error({ err }, 'idle database client error (connection dropped by server)')
})

export const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) })

export async function pingDb(): Promise<void> {
  await db.selectFrom('users').select('id').limit(1).execute()
}

export async function closeDb(): Promise<void> {
  await db.destroy()
}
