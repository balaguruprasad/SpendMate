import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestError, UnauthorizedError } from '../../core/errors/index.js'

// Mock the data layer and the db (txn) so rotation/reuse logic can run without Postgres.
vi.mock('./auth.repository.js', async () => {
  const { createHash } = await import('node:crypto')
  return {
    findUserById: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserByIdWithPassword: vi.fn(),
    updatePasswordHash: vi.fn(),
    createRefreshToken: vi.fn(),
    findRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeAllForUser: vi.fn(),
    // Use the real hash so tokenHash comparisons are meaningful.
    hashToken: (jwt: string) => createHash('sha256').update(jwt).digest('hex'),
  }
})
vi.mock('../../core/db/index.js', () => ({
  db: { transaction: () => ({ execute: (fn: (trx: unknown) => unknown) => fn({}) }) },
}))
vi.mock('../../core/auth/jwt.js', () => ({
  signAccess: vi.fn(async () => 'access-jwt'),
  signRefresh: vi.fn(async (_sub: string, tid: string) => `refresh-jwt:${tid}`),
  verifyRefresh: vi.fn(),
}))
vi.mock('../../core/auth/password.js', () => ({
  hashPassword: vi.fn(async () => 'new-hash'),
  verifyPassword: vi.fn(),
}))
vi.mock('../../core/audit/index.js', () => ({ writeAudit: vi.fn() }))

import * as repo from './auth.repository.js'
import { signRefresh, verifyRefresh } from '../../core/auth/jwt.js'
import { verifyPassword } from '../../core/auth/password.js'
import { changePassword, refresh, logout } from './auth.service.js'

const USER = '11111111-1111-1111-1111-111111111111'
const TID = '22222222-2222-2222-2222-222222222222'

function row(over: Partial<Awaited<ReturnType<typeof repo.findRefreshToken>>> = {}) {
  return {
    id: TID,
    userId: USER,
    tokenHash: repo.hashToken(`refresh-jwt:${TID}`),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    revokedAt: null,
    replacedByTokenId: null,
    userAgent: null,
    ip: null,
    createdAt: new Date(),
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(signRefresh).mockImplementation(async (_s, tid) => `refresh-jwt:${tid}`)
})

describe('refresh — rotation', () => {
  it('rotates: revokes the old token (pointing at the new) and returns a NEW refresh token', async () => {
    vi.mocked(verifyRefresh).mockResolvedValue({ sub: USER, tid: TID })
    vi.mocked(repo.findRefreshToken).mockResolvedValue(row())
    vi.mocked(repo.findUserById).mockResolvedValue({
      id: USER, email: 'a@b.co', name: 'A', role: 'ADMIN', departmentId: null,
    })

    const out = await refresh(`refresh-jwt:${TID}`)

    expect(out.accessToken).toBe('access-jwt')
    expect(out.refreshToken).not.toBe(`refresh-jwt:${TID}`) // value rotated
    expect(repo.createRefreshToken).toHaveBeenCalledOnce()
    // old token revoked, replacedByTokenId = the new tid
    const call = vi.mocked(repo.revokeRefreshToken).mock.calls[0]!
    expect(call[0]).toBe(TID)
    expect(call[1]).toBeTypeOf('string')
    expect(call[1]).not.toBe(TID)
    expect(repo.revokeAllForUser).not.toHaveBeenCalled()
  })
})

describe('refresh — reuse / theft detection', () => {
  it('revokes ALL tokens and 401 TOKEN_REUSE_DETECTED when an already-revoked token is replayed', async () => {
    vi.mocked(verifyRefresh).mockResolvedValue({ sub: USER, tid: TID })
    vi.mocked(repo.findRefreshToken).mockResolvedValue(row({ revokedAt: new Date() }))

    await expect(refresh(`refresh-jwt:${TID}`)).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_REUSE_DETECTED',
    })
    expect(repo.revokeAllForUser).toHaveBeenCalledWith(USER)
    expect(repo.createRefreshToken).not.toHaveBeenCalled()
  })

  it('revokes ALL tokens on a hash mismatch (tampering)', async () => {
    vi.mocked(verifyRefresh).mockResolvedValue({ sub: USER, tid: TID })
    vi.mocked(repo.findRefreshToken).mockResolvedValue(row({ tokenHash: 'deadbeef' }))

    await expect(refresh(`refresh-jwt:${TID}`)).rejects.toMatchObject({ code: 'TOKEN_REUSE_DETECTED' })
    expect(repo.revokeAllForUser).toHaveBeenCalledWith(USER)
  })
})

describe('refresh — rejections without revoke-all', () => {
  it('401s on an unknown token (no DB row)', async () => {
    vi.mocked(verifyRefresh).mockResolvedValue({ sub: USER, tid: TID })
    vi.mocked(repo.findRefreshToken).mockResolvedValue(undefined)
    await expect(refresh(`refresh-jwt:${TID}`)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(repo.revokeAllForUser).not.toHaveBeenCalled()
  })

  it('401s on an expired (but not revoked) token without nuking the family', async () => {
    vi.mocked(verifyRefresh).mockResolvedValue({ sub: USER, tid: TID })
    vi.mocked(repo.findRefreshToken).mockResolvedValue(row({ expiresAt: new Date(Date.now() - 1000) }))
    await expect(refresh(`refresh-jwt:${TID}`)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(repo.revokeAllForUser).not.toHaveBeenCalled()
  })
})

describe('changePassword — self change', () => {
  it('401 INVALID_PASSWORD when the current password is wrong (no write, no revoke)', async () => {
    vi.mocked(repo.findUserByIdWithPassword).mockResolvedValue({
      id: USER, email: 'a@b.co', passwordHash: 'h', name: 'A', role: 'ADMIN', departmentId: null,
    })
    vi.mocked(verifyPassword).mockResolvedValue(false)

    await expect(changePassword(USER, 'WRONG', 'New@2026!')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_PASSWORD',
    })
    expect(repo.updatePasswordHash).not.toHaveBeenCalled()
    expect(repo.revokeAllForUser).not.toHaveBeenCalled()
  })

  it('400 SAME_PASSWORD when new equals current', async () => {
    vi.mocked(repo.findUserByIdWithPassword).mockResolvedValue({
      id: USER, email: 'a@b.co', passwordHash: 'h', name: 'A', role: 'ADMIN', departmentId: null,
    })
    vi.mocked(verifyPassword).mockResolvedValue(true)

    await expect(changePassword(USER, 'Same@2026!', 'Same@2026!')).rejects.toBeInstanceOf(BadRequestError)
    expect(repo.updatePasswordHash).not.toHaveBeenCalled()
  })

  it('updates the hash and does NOT revoke the caller sessions on success', async () => {
    vi.mocked(repo.findUserByIdWithPassword).mockResolvedValue({
      id: USER, email: 'a@b.co', passwordHash: 'h', name: 'A', role: 'ADMIN', departmentId: null,
    })
    vi.mocked(verifyPassword).mockResolvedValue(true)

    const out = await changePassword(USER, 'Old@2026!', 'New@2026!')

    expect(out).toEqual({ success: true })
    expect(repo.updatePasswordHash).toHaveBeenCalledWith(USER, 'new-hash', expect.anything())
    expect(repo.revokeAllForUser).not.toHaveBeenCalled()
  })
})

describe('logout', () => {
  it('revokes the presented token server-side', async () => {
    vi.mocked(verifyRefresh).mockResolvedValue({ sub: USER, tid: TID })
    await logout(`refresh-jwt:${TID}`)
    expect(repo.revokeRefreshToken).toHaveBeenCalledWith(TID)
  })

  it('is a no-op on a bad token (never throws)', async () => {
    vi.mocked(verifyRefresh).mockRejectedValue(new Error('bad jwt'))
    await expect(logout('garbage')).resolves.toBeUndefined()
    expect(repo.revokeRefreshToken).not.toHaveBeenCalled()
  })
})
