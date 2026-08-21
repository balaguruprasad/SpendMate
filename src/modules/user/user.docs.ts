import { registry } from '../../core/docs/registry.js'
import { createUserBody, updateUserBody, resetPasswordBody } from './user.schema.js'

const bearer = [{ bearerAuth: [] as string[] }]

registry.registerPath({
  method: 'get',
  path: '/users',
  tags: ['Users'],
  summary: 'List users (ordered by name; optional ?role=&departmentId=&activeOnly=) (ADMIN only)',
  security: bearer,
  responses: {
    200: { description: 'Users (no passwordHash)' },
    401: { description: 'Unauthenticated' },
    403: { description: 'FORBIDDEN' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/users',
  tags: ['Users'],
  summary: 'Create a user with an initial password (ADMIN only)',
  security: bearer,
  request: { body: { content: { 'application/json': { schema: createUserBody } } } },
  responses: {
    201: { description: 'Created user (no passwordHash)' },
    403: { description: 'FORBIDDEN' },
    409: { description: 'USER_EMAIL_TAKEN' },
    422: { description: 'VALIDATION_ERROR' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Get one user (ADMIN only)',
  security: bearer,
  responses: { 200: { description: 'The user' }, 403: { description: 'FORBIDDEN' }, 404: { description: 'Not found' } },
})

registry.registerPath({
  method: 'patch',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Update a user — name/role/departmentId/isActive (ADMIN only)',
  security: bearer,
  request: { body: { content: { 'application/json': { schema: updateUserBody } } } },
  responses: {
    200: { description: 'Updated user' },
    403: { description: 'FORBIDDEN' },
    404: { description: 'Not found' },
  },
})

registry.registerPath({
  method: 'patch',
  path: '/users/{id}/password',
  tags: ['Users'],
  summary: "Reset a user's password (ADMIN only). Revokes the target's existing sessions. Never returns the password/hash.",
  security: bearer,
  request: { body: { content: { 'application/json': { schema: resetPasswordBody } } } },
  responses: {
    200: { description: '{ success: true }' },
    403: { description: 'FORBIDDEN' },
    404: { description: 'Not found' },
    422: { description: 'VALIDATION_ERROR' },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Deactivate a user (soft, isActive=false). Cannot deactivate self. (ADMIN only)',
  security: bearer,
  responses: {
    200: { description: 'Deactivated user' },
    403: { description: 'FORBIDDEN' },
    404: { description: 'Not found' },
    409: { description: 'CANNOT_DEACTIVATE_SELF' },
  },
})
