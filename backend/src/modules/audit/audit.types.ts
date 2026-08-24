import type { Selectable } from 'kysely'
import type { AuditLog as AuditLogTable } from '../../core/db/types.js'

/** An audit-log row as read from the DB. */
export type AuditLogRow = Selectable<AuditLogTable>

/** A list item: the row enriched with the actor's display name ("System" when actorId is null). */
export type AuditLogItem = AuditLogRow & { actorName: string }
