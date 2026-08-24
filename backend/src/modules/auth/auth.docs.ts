import { registry } from '../../core/docs/registry.js'
import { loginBody, changePasswordBody } from './auth.schema.js'

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Log in with email + password',
  request: { body: { content: { 'application/json': { schema: loginBody } } } },
  responses: {
    200: { description: 'Logged in — returns { accessToken, user }; sets refresh cookie' },
    401: { description: 'Invalid credentials' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Rotate the refresh cookie and mint a new access token',
  responses: {
    200: { description: 'New access token; sets a rotated refresh cookie' },
    401: { description: 'Missing/invalid/expired refresh token, or reuse detected (TOKEN_REUSE_DETECTED)' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Revoke the refresh token server-side and clear the cookie',
  responses: { 200: { description: 'Logged out' } },
})

registry.registerPath({
  method: 'post',
  path: '/auth/change-password',
  tags: ['Auth'],
  summary: 'Change your own password (verifies current password; keeps you logged in)',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: changePasswordBody } } } },
  responses: {
    200: { description: '{ success: true }' },
    400: { description: 'SAME_PASSWORD — new password equals current' },
    401: { description: 'Unauthenticated, or INVALID_PASSWORD (current password incorrect)' },
    422: { description: 'VALIDATION_ERROR' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Current user',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'The authenticated user' }, 401: { description: 'Unauthenticated' } },
})
