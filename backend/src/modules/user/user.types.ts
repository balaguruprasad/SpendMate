import type { Selectable } from 'kysely'
import type { User as UserTable } from '../../core/db/types.js'

/** A user row as read from the DB, minus the passwordHash. Never expose passwordHash. */
export type UserPublic = Omit<Selectable<UserTable>, 'passwordHash'>
