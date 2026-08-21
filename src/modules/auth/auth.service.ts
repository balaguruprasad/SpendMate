import { randomUUID } from 'node:crypto'
import { BadRequestError, UnauthorizedError } from '../../core/errors/index.js'
import { hashPassword, verifyPassword } from '../../core/auth/password.js'
import { signAccess, signRefresh, verifyRefresh } from '../../core/auth/jwt.js'
import { writeAudit } from '../../core/audit/index.js'
import { db } from '../../core/db/index.js'
import type { Role } from '../../core/db/types.js'
import {
  findUserByEmail,
  findUserById,
  findUserByIdWithPassword,
  updatePasswordHash,
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  hashToken,
  type RefreshTokenContext,
} from './auth.repository.js'

export interface PublicUser {
  id: string
  email: string
  name: string
  role: Role
  departmentId: string | null
}

export async function login(email: string, password: string, ctx: RefreshTokenContext = {}) {
  const user = await findUserByEmail(email)
  if (!user) throw new UnauthorizedError('Invalid credentials')
  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) throw new UnauthorizedError('Invalid credentials')

  const claims = { sub: user.id, role: user.role, departmentId: user.departmentId }
  const tid = randomUUID()
  const [accessToken, refreshToken] = await Promise.all([
    signAccess(claims),
    signRefresh(user.id, tid),
  ])
  // Persist the refresh token so it can be rotated/revoked server-side.
  await createRefreshToken(user.id, refreshToken, tid, ctx)

  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
  }
  return { accessToken, refreshToken, user: publicUser }
}

/**
 * Rotate a refresh token with reuse detection.
 *
 * On every successful refresh the presented token is revoked and a brand-new token (new tid +
 * JWT) is issued. If a token that was already revoked is presented again it means the chain was
 * stolen and replayed (the legitimate client has since rotated past it): we revoke EVERY token
 * for that user and 401 with TOKEN_REUSE_DETECTED. A hash mismatch (tampering) is treated the same.
 */
export async function refresh(token: string, ctx: RefreshTokenContext = {}) {
  const { sub, tid } = await verifyRefresh(token) // 401 on bad/expired JWT

  const existing = await findRefreshToken(tid)
  if (!existing) throw new UnauthorizedError() // unknown token — never issued or pruned

  if (existing.revokedAt) {
    // Reuse of an already-rotated token ⇒ theft. Nuke the whole session family.
    await revokeAllForUser(sub)
    throw new UnauthorizedError('Refresh token reuse detected', 'TOKEN_REUSE_DETECTED')
  }
  if (existing.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Refresh token expired')
  }
  if (existing.tokenHash !== hashToken(token)) {
    // Same tid, different bytes — tampering. Treat as theft.
    await revokeAllForUser(sub)
    throw new UnauthorizedError('Refresh token mismatch', 'TOKEN_REUSE_DETECTED')
  }

  const user = await findUserById(sub)
  if (!user) throw new UnauthorizedError()

  const newTid = randomUUID()
  const [accessToken, newRefresh] = await Promise.all([
    signAccess({ sub: user.id, role: user.role, departmentId: user.departmentId }),
    signRefresh(user.id, newTid),
  ])

  // Rotate atomically: issue the replacement, then revoke the old one pointing at it.
  await db.transaction().execute(async (trx) => {
    await createRefreshToken(user.id, newRefresh, newTid, ctx, trx)
    await revokeRefreshToken(tid, newTid, trx)
  })

  return { accessToken, refreshToken: newRefresh }
}

/** Server-side logout: verify the cookie token and revoke its DB row. Idempotent / best-effort. */
export async function logout(token: string): Promise<void> {
  try {
    const { tid } = await verifyRefresh(token)
    await revokeRefreshToken(tid)
  } catch {
    // A bad/expired token on logout is a no-op — the cookie gets cleared regardless.
  }
}

/**
 * Logged-in user changes their own password. Verifies the current password, rejects a no-op
 * (new === current), then writes the new hash. Deliberately does NOT revoke the caller's refresh
 * tokens — they stay logged in on this device. Never returns the password or hash.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: true }> {
  const user = await findUserByIdWithPassword(userId)
  if (!user) throw new UnauthorizedError()

  const valid = await verifyPassword(user.passwordHash, currentPassword)
  if (!valid) throw new UnauthorizedError('Current password is incorrect', 'INVALID_PASSWORD')

  if (newPassword === currentPassword) {
    throw new BadRequestError('SAME_PASSWORD', 'The new password must differ from the current password.')
  }

  await db.transaction().execute(async (trx) => {
    const passwordHash = await hashPassword(newPassword)
    await updatePasswordHash(userId, passwordHash, trx)
    await writeAudit(trx, {
      entityType: 'USER',
      entityId: userId,
      action: 'PASSWORD_CHANGED',
      actorId: userId,
    })
  })

  return { success: true }
}

export async function me(id: string): Promise<PublicUser> {
  const user = await findUserById(id)
  if (!user) throw new UnauthorizedError()
  return user
}
