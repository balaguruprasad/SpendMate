import type { Kysely, Transaction } from 'kysely'
import { db } from '../../core/db/index.js'
import type { DB, Role } from '../../core/db/types.js'
import type { UserPublic } from './user.types.js'

type Conn = Kysely<DB> | Transaction<DB>

/** Public columns only — never select passwordHash. */
const PUBLIC_COLUMNS = [
  'id',
  'email',
  'name',
  'role',
  'departmentId',
  'isActive',
  'createdAt',
  'updatedAt',
] as const

export interface ListUsersFilters {
  role?: Role
  departmentId?: string
  activeOnly?: boolean
}

export function listUsers(filters: ListUsersFilters = {}, conn: Conn = db): Promise<UserPublic[]> {
  let q = conn.selectFrom('users').select(PUBLIC_COLUMNS).orderBy('name')
  if (filters.role) q = q.where('role', '=', filters.role)
  if (filters.departmentId) q = q.where('departmentId', '=', filters.departmentId)
  if (filters.activeOnly) q = q.where('isActive', '=', true)
  return q.execute()
}

export function findById(id: string, conn: Conn = db): Promise<UserPublic | undefined> {
  return conn.selectFrom('users').select(PUBLIC_COLUMNS).where('id', '=', id).executeTakeFirst()
}

export function findByEmail(email: string, conn: Conn = db): Promise<UserPublic | undefined> {
  return conn.selectFrom('users').select(PUBLIC_COLUMNS).where('email', '=', email).executeTakeFirst()
}

/** Active users of a role as { id, name } refs, ordered by name. Used to resolve a team (e.g. L3 Finance). */
export function findActiveByRole(role: Role, conn: Conn = db): Promise<{ id: string; name: string }[]> {
  return conn
    .selectFrom('users')
    .select(['id', 'name'])
    .where('role', '=', role)
    .where('isActive', '=', true)
    .orderBy('name')
    .execute()
}

export function insertUser(
  input: { name: string; email: string; role: Role; departmentId: string | null; passwordHash: string },
  conn: Conn = db,
): Promise<UserPublic> {
  return conn
    .insertInto('users')
    .values({
      // id / createdAt / isActive are DB-generated.
      name: input.name,
      email: input.email,
      role: input.role,
      departmentId: input.departmentId,
      passwordHash: input.passwordHash,
      updatedAt: new Date(),
    })
    .returning(PUBLIC_COLUMNS)
    .executeTakeFirstOrThrow()
}

export function updateUser(
  id: string,
  patch: { name?: string; role?: Role; departmentId?: string | null; isActive?: boolean },
  conn: Conn = db,
): Promise<UserPublic | undefined> {
  return conn
    .updateTable('users')
    .set({ ...patch, updatedAt: new Date() })
    .where('id', '=', id)
    .returning(PUBLIC_COLUMNS)
    .executeTakeFirst()
}

export function setActive(id: string, isActive: boolean, conn: Conn = db): Promise<UserPublic | undefined> {
  return conn
    .updateTable('users')
    .set({ isActive, updatedAt: new Date() })
    .where('id', '=', id)
    .returning(PUBLIC_COLUMNS)
    .executeTakeFirst()
}

/** Update only the password hash. Returns the row id when a user matched, else undefined. */
export function updatePasswordHash(
  id: string,
  passwordHash: string,
  conn: Conn = db,
): Promise<{ id: string } | undefined> {
  return conn
    .updateTable('users')
    .set({ passwordHash, updatedAt: new Date() })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst()
}

/** Hard delete. Throws a Postgres FK violation (23503) if the user is referenced. */
export async function hardDelete(id: string, conn: Conn = db): Promise<void> {
  await conn.deleteFrom('users').where('id', '=', id).execute()
}
