import type { Kysely, Transaction } from 'kysely'
import { db } from '../../core/db/index.js'
import type { DB } from '../../core/db/types.js'
import type { AuditLogItem } from './audit.types.js'

type Conn = Kysely<DB> | Transaction<DB>

export interface Cursor {
  createdAt: string
  id: string
}

export function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }),
  ).toString('base64url')
}

export function decodeCursor(s: string): Cursor | null {
  try {
    return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor
  } catch {
    return null
  }
}

export async function listAudit(
  params: {
    entityType?: string
    entityId?: string
    action?: string
    limit: number
    cursor?: string
  },
  conn: Conn = db,
): Promise<{ items: AuditLogItem[]; nextCursor: string | null }> {
  let q = conn
    .selectFrom('audit_log as a')
    .leftJoin('users as u', 'u.id', 'a.actorId')
    .select([
      'a.id',
      'a.entityType',
      'a.entityId',
      'a.action',
      'a.actorId',
      'a.metadata',
      'a.createdAt',
      'u.name as actorNameRaw',
    ])
    .orderBy('a.createdAt', 'desc')
    .orderBy('a.id', 'desc')
    .limit(params.limit + 1)

  if (params.entityType) q = q.where('a.entityType', '=', params.entityType)
  if (params.entityId) q = q.where('a.entityId', '=', params.entityId)
  if (params.action) q = q.where('a.action', '=', params.action)

  if (params.cursor) {
    const cursor = decodeCursor(params.cursor)
    if (cursor) {
      const createdAt = new Date(cursor.createdAt)
      const id = cursor.id
      q = q.where((eb) =>
        eb.or([
          eb('a.createdAt', '<', createdAt),
          eb.and([eb('a.createdAt', '=', createdAt), eb('a.id', '<', id)]),
        ]),
      )
    }
  }

  const rows = await q.execute()
  const hasMore = rows.length > params.limit
  const sliced = hasMore ? rows.slice(0, params.limit) : rows
  const items: AuditLogItem[] = sliced.map((r) => {
    const { actorNameRaw, ...rest } = r
    return { ...rest, actorName: actorNameRaw ?? 'System' }
  })
  const last = sliced[sliced.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(last) : null
  return { items, nextCursor }
}
