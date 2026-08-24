import { z } from 'zod'

export const impersonateBody = z.object({
  userId: z.string().uuid(),
})
export type ImpersonateInput = z.infer<typeof impersonateBody>
