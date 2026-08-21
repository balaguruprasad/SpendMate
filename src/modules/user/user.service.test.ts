import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundError } from '../../core/errors/index.js'

// Mock the data layers + db txn so resetPassword can run without Postgres.
vi.mock('./user.repository.js', () => ({
  findById: vi.fn(),
  updatePasswordHash: vi.fn(),
}))
vi.mock('../auth/auth.repository.js', () => ({
  revokeAllForUser: vi.fn(),
}))
vi.mock('../../core/audit/index.js', () => ({ writeAudit: vi.fn() }))
vi.mock('../../core/auth/password.js', () => ({
  hashPassword: vi.fn(async () => 'hashed'),
}))
vi.mock('../../core/db/index.js', () => ({
  db: { transaction: () => ({ execute: (fn: (trx: unknown) => unknown) => fn({}) }) },
}))

import * as repo from './user.repository.js'
import { revokeAllForUser } from '../auth/auth.repository.js'
import { writeAudit } from '../../core/audit/index.js'
import { resetPassword } from './user.service.js'

const ADMIN = { sub: 'admin-id', role: 'ADMIN', departmentId: null } as never
const TARGET = 'target-id'

beforeEach(() => vi.clearAllMocks())

describe('resetPassword (admin reset)', () => {
  it('hashes, updates, revokes the target sessions, audits, and returns { success: true } — no password/hash leaked', async () => {
    vi.mocked(repo.findById).mockResolvedValue({ id: TARGET, email: 't@b.co' } as never)

    const out = await resetPassword(TARGET, 'New@2026!', ADMIN)

    expect(out).toEqual({ success: true })
    expect(repo.updatePasswordHash).toHaveBeenCalledWith(TARGET, 'hashed', expect.anything())
    expect(revokeAllForUser).toHaveBeenCalledWith(TARGET, expect.anything())
    expect(vi.mocked(writeAudit).mock.calls[0]![1]).toMatchObject({
      entityType: 'USER',
      entityId: TARGET,
      action: 'PASSWORD_RESET',
      actorId: 'admin-id',
      metadata: { targetEmail: 't@b.co' },
    })
  })

  it('404s when the target user does not exist', async () => {
    vi.mocked(repo.findById).mockResolvedValue(undefined)
    await expect(resetPassword(TARGET, 'New@2026!', ADMIN)).rejects.toBeInstanceOf(NotFoundError)
    expect(repo.updatePasswordHash).not.toHaveBeenCalled()
    expect(revokeAllForUser).not.toHaveBeenCalled()
  })
})
