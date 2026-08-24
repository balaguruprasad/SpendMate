import { db } from '../../core/db/index.js'
import { ConflictError, NotFoundError, UnprocessableError } from '../../core/errors/index.js'
import { writeAudit } from '../../core/audit/index.js'
import { signAccess } from '../../core/auth/jwt.js'
import type { Claims } from '../../core/auth/jwt.js'
import { findById } from '../user/user.repository.js'

export interface ImpersonatePublicUser {
  id: string
  email: string
  name: string
  role: Claims['role']
  departmentId: string | null
}

export interface ImpersonateResult {
  accessToken: string
  user: ImpersonatePublicUser
}

/**
 * Mint an ACCESS token carrying the TARGET user's claims, tagged with the
 * impersonating admin's id (`imp`). No cookie is set/rotated — the admin keeps
 * their own refresh cookie so they can exit back to their session via /auth/refresh.
 */
export async function impersonate(userId: string, admin: Claims): Promise<ImpersonateResult> {
  if (userId === admin.sub) {
    throw new UnprocessableError('CANNOT_IMPERSONATE_SELF', 'You cannot impersonate yourself.')
  }

  const target = await findById(userId)
  if (!target) throw new NotFoundError('User not found')
  if (!target.isActive) {
    throw new ConflictError('USER_INACTIVE', 'This user is deactivated and cannot be impersonated.')
  }

  const accessToken = await signAccess({
    sub: target.id,
    role: target.role,
    departmentId: target.departmentId,
    imp: admin.sub,
  })

  await writeAudit(db, {
    entityType: 'USER',
    entityId: target.id,
    action: 'IMPERSONATED',
    actorId: admin.sub,
    metadata: { targetEmail: target.email },
  })

  return {
    accessToken,
    user: {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      departmentId: target.departmentId,
    },
  }
}
