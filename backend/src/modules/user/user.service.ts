import { db } from '../../core/db/index.js'
import { ConflictError, NotFoundError } from '../../core/errors/index.js'
import { writeAudit } from '../../core/audit/index.js'
import { hashPassword } from '../../core/auth/password.js'
import type { Claims } from '../../core/auth/jwt.js'
import type { Role } from '../../core/db/types.js'
import * as repo from './user.repository.js'
import { revokeAllForUser } from '../auth/auth.repository.js'
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './user.schema.js'
import type { UserPublic } from './user.types.js'

export function listUsers(query: ListUsersQuery): Promise<UserPublic[]> {
  return repo.listUsers({ role: query.role, departmentId: query.departmentId, activeOnly: query.activeOnly })
}

export async function getUser(id: string): Promise<UserPublic> {
  const row = await repo.findById(id)
  if (!row) throw new NotFoundError('User not found')
  return row
}

export async function createUser(input: CreateUserInput, user: Claims): Promise<UserPublic> {
  const email = input.email.trim().toLowerCase()
  return db.transaction().execute(async (trx) => {
    if (await repo.findByEmail(email, trx)) {
      throw new ConflictError('USER_EMAIL_TAKEN', `A user with email ${email} already exists.`)
    }
    const passwordHash = await hashPassword(input.password)
    const created = await repo.insertUser(
      {
        name: input.name,
        email,
        role: input.role,
        departmentId: null,
        passwordHash,
      },
      trx,
    )
    await writeAudit(trx, {
      entityType: 'USER',
      entityId: created.id,
      action: 'CREATED',
      actorId: user.sub,
      metadata: { email: created.email, name: created.name, role: created.role },
    })
    return created
  })
}

export async function updateUser(id: string, input: UpdateUserInput, user: Claims): Promise<UserPublic> {
  return db.transaction().execute(async (trx) => {
    const current = await repo.findById(id, trx)
    if (!current) throw new NotFoundError('User not found')

    const patch: { name?: string; role?: Role; isActive?: boolean } = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.role !== undefined) patch.role = input.role
    if (input.isActive !== undefined) patch.isActive = input.isActive

    const updated = await repo.updateUser(id, patch, trx)
    if (!updated) throw new NotFoundError('User not found')
    await writeAudit(trx, {
      entityType: 'USER',
      entityId: id,
      action: 'UPDATED',
      actorId: user.sub,
      metadata: patch,
    })
    return updated
  })
}

/**
 * Admin resets any user's password. Hashes the new password, writes it, and revokes ALL of the
 * target's refresh tokens so any existing session signed in with the old password is killed —
 * all in one transaction. Never returns the password or hash.
 */
export async function resetPassword(id: string, newPassword: string, admin: Claims): Promise<{ success: true }> {
  return db.transaction().execute(async (trx) => {
    const target = await repo.findById(id, trx)
    if (!target) throw new NotFoundError('User not found')

    const passwordHash = await hashPassword(newPassword)
    await repo.updatePasswordHash(id, passwordHash, trx)
    await revokeAllForUser(id, trx)

    await writeAudit(trx, {
      entityType: 'USER',
      entityId: target.id,
      action: 'PASSWORD_RESET',
      actorId: admin.sub,
      metadata: { targetEmail: target.email },
    })
    return { success: true }
  })
}

/** Postgres foreign-key violation (23503), tolerant of wrapped/nested errors. */
function isFkViolation(e: unknown): boolean {
  const codeOf = (x: unknown): string | undefined =>
    typeof x === 'object' && x !== null && 'code' in x
      ? String((x as { code?: unknown }).code)
      : undefined
  if (codeOf(e) === '23503') return true
  if (typeof e === 'object' && e !== null && 'cause' in e && codeOf((e as { cause?: unknown }).cause) === '23503') {
    return true
  }
  const msg = e instanceof Error ? e.message : String(e)
  return /foreign key constraint|violates foreign key/i.test(msg)
}

/**
 * Hard-delete a user. Blocked (409) when the user is referenced by financial
 * history (invoices, approvals, audit, vendors, payments, approval matrix) —
 * those records must keep their actor. The admin can deactivate such users
 * instead (via the edit form's Active toggle).
 */
export async function deleteUser(id: string, user: Claims): Promise<UserPublic> {
  if (id === user.sub) {
    throw new ConflictError('CANNOT_DELETE_SELF', 'You cannot delete your own account.')
  }
  return db.transaction().execute(async (trx) => {
    const current = await repo.findById(id, trx)
    if (!current) throw new NotFoundError('User not found')
    try {
      await repo.hardDelete(id, trx)
    } catch (e) {
      if (isFkViolation(e)) {
        throw new ConflictError(
          'USER_HAS_ACTIVITY',
          'This user has activity (invoices, approvals, or audit history) and cannot be deleted. Deactivate them instead.',
        )
      }
      throw e
    }
    await writeAudit(trx, {
      entityType: 'USER',
      entityId: id,
      action: 'DELETED',
      actorId: user.sub,
      metadata: { email: current.email, name: current.name },
    })
    return current
  })
}

function parseCsv(text: string): string[][] {
  const lines: string[][] = []
  let line: string[] = []
  let entry = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        entry += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      line.push(entry.trim())
      entry = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      line.push(entry.trim())
      if (line.length > 1 || line[0] !== '') {
        lines.push(line)
      }
      line = []
      entry = ''
    } else {
      entry += char
    }
  }

  if (entry || line.length > 0) {
    line.push(entry.trim())
    lines.push(line)
  }

  return lines
}

export async function exportUsersToCsv(): Promise<string> {
  const users = await db
    .selectFrom('users')
    .select(['name', 'email', 'role', 'isActive'])
    .orderBy('name')
    .execute()

  let csv = 'Name,Email,Role,Status\n'
  for (const u of users) {
    const status = u.isActive ? 'Active' : 'Inactive'

    const escape = (val: string) => {
      const s = String(val ?? '')
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }

    csv += `${escape(u.name)},${escape(u.email)},${u.role},${status}\n`
  }
  return csv
}

export async function generateUserTemplateCsv(): Promise<string> {
  let csv = 'Name,Email,Role,Password\n'
  csv += 'John Doe,john.doe@example.com,MEMBER,Mesa@2026!\n'
  csv += 'Jane Smith,jane.smith@example.com,ADMIN,Mesa@2026!\n'
  csv += '\n'
  csv += '# Instructions:\n'
  csv += '# 1. Role must be one of: ADMIN, MEMBER\n'
  csv += '# 2. Password is required and must be at least 8 characters.\n'
  csv += '# 3. Status is default Active. Save as CSV before uploading.\n'

  return csv
}

export interface BulkUploadResult {
  processed: number
  created: number
  skipped: number
  errors: { row: number; email?: string; error: string }[]
}

export async function bulkUploadUsers(csvText: string, admin: Claims): Promise<BulkUploadResult> {
  const rows = parseCsv(csvText)
  if (rows.length === 0) {
    return { processed: 0, created: 0, skipped: 0, errors: [{ row: 0, error: 'CSV file is empty.' }] }
  }

  // Identify column headers (Name, Email, Role, Department, Password) - case insensitive
  const headers = rows[0]!.map((h) => h.toLowerCase().trim())
  const nameIdx = headers.indexOf('name')
  const emailIdx = headers.indexOf('email')
  const roleIdx = headers.indexOf('role')
  const deptIdx = headers.indexOf('department')
  const passIdx = headers.indexOf('password')

  if (nameIdx === -1 || emailIdx === -1 || roleIdx === -1) {
    return {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: [
        {
          row: 1,
          error: 'Required headers missing. CSV must contain at least: Name, Email, Role.',
        },
      ],
    }
  }

  const VALID_ROLES: Role[] = ['ADMIN', 'MEMBER']
  const results: BulkUploadResult = { processed: 0, created: 0, skipped: 0, errors: [] }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!
    
    // Skip comment lines or empty lines
    if (row.length === 0 || row[0]?.startsWith('#') || row.every((val) => val === '')) {
      continue
    }

    results.processed++
    const rowNum = i + 1

    const name = row[nameIdx]?.trim() ?? ''
    const email = row[emailIdx]?.trim().toLowerCase() ?? ''
    const roleRaw = row[roleIdx]?.trim().toUpperCase() ?? ''
    const deptRaw = deptIdx !== -1 ? row[deptIdx]?.trim() : ''
    const password = passIdx !== -1 ? row[passIdx] ?? '' : 'Mesa@2026!' // default if omitted

    if (!name) {
      results.errors.push({ row: rowNum, error: 'Name is required.' })
      continue
    }

    if (!email) {
      results.errors.push({ row: rowNum, error: 'Email is required.' })
      continue
    }

    // Basic email format check
    if (!email.includes('@')) {
      results.errors.push({ row: rowNum, email, error: 'Invalid email format.' })
      continue
    }

    if (!VALID_ROLES.includes(roleRaw as Role)) {
      results.errors.push({
        row: rowNum,
        email,
        error: `Invalid role '${roleRaw}'. Must be one of: ADMIN, MEMBER.`,
      })
      continue
    }

    if (password && password.length < 8) {
      results.errors.push({
        row: rowNum,
        email,
        error: 'Password must be at least 8 characters long.',
      })
      continue
    }

    // Check if user already exists
    const existing = await repo.findByEmail(email)
    if (existing) {
      results.skipped++
      continue
    }

    try {
      const passwordHash = await hashPassword(password)
      await repo.insertUser({
        name,
        email,
        role: roleRaw as Role,
        departmentId: null,
        passwordHash,
      })
      results.created++
    } catch (e) {
      results.errors.push({
        row: rowNum,
        email,
        error: e instanceof Error ? e.message : 'Failed to insert user.',
      })
    }
  }

  return results
}
