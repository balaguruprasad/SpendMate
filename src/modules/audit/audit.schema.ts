import { z } from 'zod'

export const listAuditQuery = z.object({
  entityType: z.string().min(1).max(100).optional(),
  entityId: z.string().min(1).max(100).optional(),
  action: z.string().min(1).max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})
export type ListAuditQuery = z.infer<typeof listAuditQuery>
