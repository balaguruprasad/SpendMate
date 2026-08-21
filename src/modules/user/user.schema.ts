import { z } from 'zod'
import { Role } from '../../core/db/types.js'

const roleEnum = z.enum([Role.MEMBER, Role.ADMIN])

export const createUserBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: roleEnum,
  password: z.string().min(8),
})
export type CreateUserInput = z.infer<typeof createUserBody>

export const updateUserBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: roleEnum.optional(),
  departmentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})
export type UpdateUserInput = z.infer<typeof updateUserBody>

export const resetPasswordBody = z.object({
  newPassword: z.string().min(8),
})
export type ResetPasswordInput = z.infer<typeof resetPasswordBody>

export const listUsersQuery = z.object({
  role: roleEnum.optional(),
  departmentId: z.string().uuid().optional(),
  activeOnly: z.coerce.boolean().optional(),
})
export type ListUsersQuery = z.infer<typeof listUsersQuery>
