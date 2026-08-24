import type { Selectable } from 'kysely'
import type { Notification as NotificationTable } from '../../core/db/types.js'

/** A notification row as read from the DB. */
export type NotificationRow = Selectable<NotificationTable>
