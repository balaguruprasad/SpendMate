import { randomUUID } from 'node:crypto'
import type { Kysely, Transaction } from 'kysely'
import type { DB } from '../db/types.js'

type Conn = Kysely<DB> | Transaction<DB>

export interface AuditInput {
  entityType: string
  entityId: string
  action: string
  actorId: string
  metadata?: Record<string, unknown>
}

export async function writeAudit(conn: Conn, input: AuditInput): Promise<void> {
  await conn
    .insertInto('audit_log')
    .values({
      id: randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    })
    .execute()
}
