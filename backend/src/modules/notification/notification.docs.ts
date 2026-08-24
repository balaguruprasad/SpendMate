import { registry } from '../../core/docs/registry.js'

const bearer = [{ bearerAuth: [] as string[] }]

registry.registerPath({
  method: 'get',
  path: '/notifications',
  tags: ['Notifications'],
  summary: "List the caller's notifications, newest-first",
  description: 'Returns { data, meta.unreadCount }. Auth required; always scoped to the caller.',
  security: bearer,
  responses: {
    200: { description: "The caller's notifications + meta.unreadCount" },
    401: { description: 'Unauthenticated' },
  },
})

registry.registerPath({
  method: 'patch',
  path: '/notifications/{id}/read',
  tags: ['Notifications'],
  summary: 'Mark one notification (owned by the caller) read',
  security: bearer,
  responses: {
    200: { description: 'The updated notification' },
    401: { description: 'Unauthenticated' },
    404: { description: 'Not found / not owned by the caller' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/notifications/read-all',
  tags: ['Notifications'],
  summary: "Mark all of the caller's notifications read",
  security: bearer,
  responses: {
    200: { description: '{ updated: number }' },
    401: { description: 'Unauthenticated' },
  },
})
