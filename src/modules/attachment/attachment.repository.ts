import { randomUUID } from 'node:crypto'
import type { Kysely, Transaction } from 'kysely'
import { db } from '../../core/db/index.js'
import type { DB, AttachmentEntity } from '../../core/db/types.js'
import type { AttachmentRow } from './attachment.types.js'

type Conn = Kysely<DB> | Transaction<DB>

export interface InsertAttachmentInput {
  entityType: AttachmentEntity
  entityId: string
  storageKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string | null
}

export function insertAttachment(input: InsertAttachmentInput, conn: Conn = db): Promise<AttachmentRow> {
  return conn
    .insertInto('attachments')
    .values({
      id: randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      storageKey: input.storageKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedBy: input.uploadedBy,
    })
    .returningAll()
    .executeTakeFirstOrThrow() as Promise<AttachmentRow>
}

export function listByEntity(
  entityType: AttachmentEntity,
  entityId: string,
  conn: Conn = db,
): Promise<AttachmentRow[]> {
  return conn
    .selectFrom('attachments')
    .selectAll()
    .where('entityType', '=', entityType)
    .where('entityId', '=', entityId)
    .orderBy('createdAt', 'asc')
    .execute() as Promise<AttachmentRow[]>
}

/** Batch-fetch all attachments for a set of entity ids of the same type. */
export function findByEntityIds(
  entityType: AttachmentEntity,
  entityIds: string[],
  conn: Conn = db,
): Promise<AttachmentRow[]> {
  if (entityIds.length === 0) return Promise.resolve([])
  return conn
    .selectFrom('attachments')
    .selectAll()
    .where('entityType', '=', entityType)
    .where('entityId', 'in', entityIds)
    .orderBy('createdAt', 'asc')
    .execute() as Promise<AttachmentRow[]>
}

export function findById(id: string, conn: Conn = db): Promise<AttachmentRow | undefined> {
  return conn
    .selectFrom('attachments')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst() as Promise<AttachmentRow | undefined>
}

export async function deleteById(id: string, conn: Conn = db): Promise<void> {
  await conn.deleteFrom('attachments').where('id', '=', id).execute()
}

// --- Parent-entity visibility lookups (used by the attachment visibility guard) --------------

/** The charge + its cardholder (via the matched card), for the visibility rule. */
export async function findTransactionAuth(
  id: string,
  conn: Conn = db,
): Promise<{ id: string; holderId: string | null } | undefined> {
  const row = await conn
    .selectFrom('transactions')
    .leftJoin('cards', 'cards.id', 'transactions.cardId')
    .select(['transactions.id'])
    .select('cards.holderId as holderId')
    .where('transactions.id', '=', id)
    .executeTakeFirst()
  return row as { id: string; holderId: string | null } | undefined
}

/** Whether helperId is one of holderId's invoice helpers. */
export async function isHelperOf(holderId: string, helperId: string, conn: Conn = db): Promise<boolean> {
  const row = await conn
    .selectFrom('card_helpers')
    .select('id')
    .where('holderId', '=', holderId)
    .where('helperId', '=', helperId)
    .executeTakeFirst()
  return Boolean(row)
}
