import * as repo from './audit.repository.js'
import type { ListAuditQuery } from './audit.schema.js'

export async function listAudit(query: ListAuditQuery) {
  const { items, nextCursor } = await repo.listAudit({
    entityType: query.entityType,
    entityId: query.entityId,
    action: query.action,
    limit: query.limit,
    cursor: query.cursor,
  })
  return { items, nextCursor }
}
