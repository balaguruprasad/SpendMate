import { z } from 'zod'
import { AttachmentEntity } from '../../core/db/types.js'

/** Allowed upload MIME types and the per-file size cap. */
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const
export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export const entityTypeSchema = z.enum(
  Object.values(AttachmentEntity) as [string, ...string[]],
)

export const mimeTypeSchema = z.enum(ALLOWED_MIME_TYPES, {
  message: 'Unsupported file type. Allowed: PDF, PNG, JPEG.',
})

/** Body for POST /attachments/sign (request a pre-signed upload URL). */
export const signUploadBody = z.object({
  entityType: entityTypeSchema,
  fileName: z.string().min(1).max(255),
  mimeType: mimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES, 'File exceeds the 10 MB limit.'),
})
export type SignUploadInput = z.infer<typeof signUploadBody>

/** Body for POST /attachments/upload (proxy) — only the entityType; the file rides in multipart. */
export const proxyUploadBody = z.object({
  entityType: entityTypeSchema,
})
export type ProxyUploadInput = z.infer<typeof proxyUploadBody>

/** Body for POST /attachments (register an already-uploaded object as a row). */
export const registerAttachmentBody = z.object({
  entityType: entityTypeSchema,
  entityId: z.uuid('entityId must be a valid UUID'),
  gcsKey: z.string().min(1).max(1024),
  fileName: z.string().min(1).max(255),
  mimeType: mimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES, 'File exceeds the 10 MB limit.'),
})
export type RegisterAttachmentInput = z.infer<typeof registerAttachmentBody>

/** Reusable shape for create-payload embedded attachments (vendor/invoice create bodies). */
export const embeddedAttachmentSchema = z.object({
  gcsKey: z.string().min(1).max(1024),
  fileName: z.string().min(1).max(255),
  mimeType: mimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES, 'File exceeds the 10 MB limit.'),
})
export type EmbeddedAttachmentInput = z.infer<typeof embeddedAttachmentSchema>

export const listAttachmentsQuery = z.object({
  entityType: entityTypeSchema,
  entityId: z.uuid('entityId must be a valid UUID'),
})
export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQuery>
