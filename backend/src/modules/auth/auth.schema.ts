import { z } from 'zod'

export const loginBody = z.object({
  email: z.email(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof loginBody>

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})
export type ChangePasswordInput = z.infer<typeof changePasswordBody>
