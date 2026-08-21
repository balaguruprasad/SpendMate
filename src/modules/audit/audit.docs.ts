import { registry } from '../../core/docs/registry.js'

const bearer = [{ bearerAuth: [] as string[] }]

registry.registerPath({
  method: 'get',
  path: '/audit',
  tags: ['Audit'],
  summary: 'List audit-log entries (ADMIN/FINANCE), newest-first, cursor-paginated',
  description:
    'Optional filters ?entityType= &entityId= &action=. Each row is enriched with actorName (the actor user\'s name, or "System" when actorId is null). Returns { data, meta.nextCursor }. limit ≤ 100 (default 20).',
  security: bearer,
  responses: {
    200: { description: 'A page of audit rows with meta.nextCursor; each row carries actorName' },
    401: { description: 'Unauthenticated' },
    403: { description: 'Forbidden (not ADMIN/FINANCE)' },
  },
})
