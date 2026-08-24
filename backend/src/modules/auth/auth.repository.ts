import { createHash } from 'node:crypto'
import type { Kysely, Transaction } from 'kysely'
import { db } from '../../core/db/index.js'
import type { DB } from '../../core/db/types.js'

type Conn = Kysely<DB> | Transaction<DB>

export function findUserByEmail(email: string) {
  return db
    .selectFrom('users')
    .select(['id', 'email', 'passwordHash', 'name', 'role', 'departmentId'])
    .where('email', '=', email)
    .executeTakeFirst()
}

export function findUserById(id: string) {
  return db
    .selectFrom('users')
    .select(['id', 'email', 'name', 'role', 'departmentId'])
    .where('id', '=', id)
    .executeTakeFirst()
}

/** Like findUserById but includes the passwordHash — for verifying the caller's current password. */
export function findUserByIdWithPassword(id: string) {
  return db
    .selectFrom('users')
    .select(['id', 'email', 'passwordHash', 'name', 'role', 'departmentId'])
    .where('id', '=', id)
    .executeTakeFirst()
}

/** Update only the password hash for a user. */
export function updatePasswordHash(id: string, passwordHash: string, conn: Conn = db) {
  return conn
    .updateTable('users')
    .set({ passwordHash, updatedAt: new Date() })
    .where('id', '=', id)
    .executeTakeFirst()
}

// --- Refresh-token store --------------------------------------------------------
// Refresh tokens are persisted as a sha256 of the signed JWT (never the JWT itself), so a
// DB leak cannot be replayed as a session. The row id IS the `tid` embedded in the JWT, which
// lets us look up the row from a presented token in O(1) and rotate it.

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // sliding-window length; matches signRefresh("30d")

export function hashToken(jwt: string): string {
  return createHash('sha256').update(jwt).digest('hex')
}

export interface RefreshTokenContext {
  userAgent?: string | null
  ip?: string | null
}

/** Insert a refresh-token row. `tid` is the JWT's tid claim and becomes the row id. */
export function createRefreshToken(
  userId: string,
  jwt: string,
  tid: string,
  ctx: RefreshTokenContext = {},
  conn: Conn = db,
) {
  return conn
    .insertInto('refresh_tokens')
    .values({
      id: tid,
      userId,
      tokenHash: hashToken(jwt),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: ctx.userAgent ?? null,
      ip: ctx.ip ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export function findRefreshToken(tid: string, conn: Conn = db) {
  return conn
    .selectFrom('refresh_tokens')
    .selectAll()
    .where('id', '=', tid)
    .executeTakeFirst()
}

/** Revoke a single token, optionally recording the token that replaced it (rotation chain). */
export function revokeRefreshToken(tid: string, replacedByTokenId?: string, conn: Conn = db) {
  return conn
    .updateTable('refresh_tokens')
    .set({ revokedAt: new Date(), replacedByTokenId: replacedByTokenId ?? null })
    .where('id', '=', tid)
    .where('revokedAt', 'is', null)
    .executeTakeFirst()
}

/** Theft response: revoke every live token for a user, killing all their sessions. */
export function revokeAllForUser(userId: string, conn: Conn = db) {
  return conn
    .updateTable('refresh_tokens')
    .set({ revokedAt: new Date() })
    .where('userId', '=', userId)
    .where('revokedAt', 'is', null)
    .executeTakeFirst()
}

/** Optional housekeeping: drop expired rows. Not wired to a scheduler — call ad hoc. */
export function pruneExpired(conn: Conn = db) {
  return conn
    .deleteFrom('refresh_tokens')
    .where('expiresAt', '<', new Date())
    .executeTakeFirst()
}
