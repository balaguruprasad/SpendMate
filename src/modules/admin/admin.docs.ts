import { registry } from '../../core/docs/registry.js'
import { impersonateBody } from './admin.schema.js'

registry.registerPath({
  method: 'post',
  path: '/admin/impersonate',
  tags: ['Admin'],
  summary: 'Impersonate a user (ADMIN only) — "view as user"',
  description:
    'Issues an access token carrying the target user\'s claims (tagged with the admin id as `imp`). ' +
    'No cookie is set/rotated; the admin keeps their own refresh cookie to exit via /auth/refresh.',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: impersonateBody } } } },
  responses: {
    200: { description: 'Returns { accessToken, user } acting as the target user' },
    403: { description: 'Caller is not an ADMIN' },
    404: { description: 'Target user not found' },
    409: { description: 'USER_INACTIVE — target is deactivated' },
    422: { description: 'CANNOT_IMPERSONATE_SELF — cannot impersonate yourself' },
  },
})
