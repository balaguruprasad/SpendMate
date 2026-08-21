import { registry } from '../../core/docs/registry.js'
import { registerAttachmentBody, signUploadBody } from './attachment.schema.js'

const bearer = [{ bearerAuth: [] as string[] }]

registry.registerPath({
  method: 'get',
  path: '/attachments/config',
  tags: ['Attachments'],
  summary: 'Upload mode (proxy vs signed URLs)',
  security: bearer,
  responses: { 200: { description: '{ data: { useSignedUrls: boolean } }' } },
})

registry.registerPath({
  method: 'post',
  path: '/attachments/upload',
  tags: ['Attachments'],
  summary: 'Proxy upload a single file to GCS (multipart; local mode)',
  security: bearer,
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              file: { type: 'string', format: 'binary' },
              entityType: { type: 'string', enum: ['VENDOR', 'INVOICE', 'PAYMENT'] },
            },
            required: ['file', 'entityType'],
          },
        },
      },
    },
  },
  responses: {
    200: { description: '{ data: { gcsKey, fileName, mimeType, sizeBytes } }' },
    422: { description: 'UNSUPPORTED_FILE_TYPE / FILE_TOO_LARGE / VALIDATION_ERROR' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/attachments/sign',
  tags: ['Attachments'],
  summary: 'Get a pre-signed PUT URL (signed/prod mode)',
  security: bearer,
  request: { body: { content: { 'application/json': { schema: signUploadBody } } } },
  responses: {
    200: { description: '{ data: { uploadUrl, gcsKey } }' },
    422: { description: 'UNSUPPORTED_FILE_TYPE / FILE_TOO_LARGE / VALIDATION_ERROR' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/attachments',
  tags: ['Attachments'],
  summary: 'Register an uploaded object as an attachment row',
  security: bearer,
  request: { body: { content: { 'application/json': { schema: registerAttachmentBody } } } },
  responses: { 201: { description: 'The attachment row' }, 422: { description: 'VALIDATION_ERROR' } },
})

registry.registerPath({
  method: 'get',
  path: '/attachments',
  tags: ['Attachments'],
  summary: 'List attachments for an entity (each with a downloadUrl)',
  security: bearer,
  responses: { 200: { description: 'Attachment rows' } },
})

registry.registerPath({
  method: 'get',
  path: '/attachments/{id}/download',
  tags: ['Attachments'],
  summary: 'Download an attachment (redirect to signed URL, or stream)',
  security: bearer,
  responses: { 200: { description: 'File stream' }, 302: { description: 'Redirect to signed URL' }, 404: { description: 'Not found' } },
})

registry.registerPath({
  method: 'delete',
  path: '/attachments/{id}',
  tags: ['Attachments'],
  summary: 'Delete an attachment (uploader or ADMIN)',
  security: bearer,
  responses: { 204: { description: 'Deleted' }, 403: { description: 'FORBIDDEN' }, 404: { description: 'Not found' } },
})
