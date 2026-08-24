import { randomUUID } from 'node:crypto'
import type { Kysely, Transaction } from 'kysely'
import type { DB, Role } from '../db/types.js'

type Conn = Kysely<DB> | Transaction<DB>

export interface NotifyInput {
  userId: string
  type: string
  title: string
  body?: string | null
  linkPath?: string | null
}

/**
 * Insert a single in-app notification within the caller's transaction. Kept tiny and
 * dependency-free so flow services can emit alongside their own writes. Callers that build
 * recipient lists should skip when no recipient is found (see emit helpers below).
 */
export async function createNotification(conn: Conn, input: NotifyInput): Promise<void> {
  await conn
    .insertInto('notifications')
    .values({
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      linkPath: input.linkPath ?? null,
    })
    .execute()
}

/** Active user ids for a given role (small sets: FINANCE, ACCOUNTS). */
export async function findActiveUserIdsByRole(conn: Conn, role: Role): Promise<string[]> {
  const rows = await conn
    .selectFrom('users')
    .select('id')
    .where('role', '=', role)
    .where('isActive', '=', true)
    .execute()
  return rows.map((r) => r.id)
}

