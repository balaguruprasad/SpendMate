import type { Kysely, Transaction } from 'kysely'
import { db } from '../../core/db/index.js'
import type { DB } from '../../core/db/types.js'
import type { NotificationRow } from './notification.types.js'

type Conn = Kysely<DB> | Transaction<DB>

/** A caller's notifications, newest-first (bounded to keep the payload small). */
export function listForUser(userId: string, limit = 100, conn: Conn = db): Promise<NotificationRow[]> {
  return conn
    .selectFrom('notifications')
    .selectAll()
    .where('userId', '=', userId)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(limit)
    .execute()
}

export async function unreadCount(userId: string, conn: Conn = db): Promise<number> {
  const row = await conn
    .selectFrom('notifications')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('userId', '=', userId)
    .where('readAt', 'is', null)
    .executeTakeFirst()
  return Number(row?.count ?? 0)
}

export function findById(id: string, conn: Conn = db): Promise<NotificationRow | undefined> {
  return conn.selectFrom('notifications').selectAll().where('id', '=', id).executeTakeFirst()
}

/** Mark one notification read (only if owned + still unread). Returns the updated row or undefined. */
export function markRead(id: string, userId: string, conn: Conn = db): Promise<NotificationRow | undefined> {
  return conn
    .updateTable('notifications')
    .set({ readAt: new Date() })
    .where('id', '=', id)
    .where('userId', '=', userId)
    .returningAll()
    .executeTakeFirst()
}

/** Mark every unread notification for the caller read; returns how many were affected. */
export async function markAllRead(userId: string, conn: Conn = db): Promise<number> {
  const res = await conn
    .updateTable('notifications')
    .set({ readAt: new Date() })
    .where('userId', '=', userId)
    .where('readAt', 'is', null)
    .executeTakeFirst()
  return Number(res.numUpdatedRows ?? 0)
}
