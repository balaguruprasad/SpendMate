import { ForbiddenError, NotFoundError, UnprocessableError, ValidationError } from '../../core/errors/index.js'
import { config } from '../../core/config/index.js'
import type { Claims } from '../../core/auth/jwt.js'
import type { AttachmentEntity } from '../../core/db/types.js'
import {
  buildKey,
  deleteObject,
  readStream,
  signedDownloadUrl,
  signedUploadUrl,
  uploadBuffer,
  useSignedUrls,
} from '../../core/storage/gcs.js'
import * as repo from './attachment.repository.js'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  type ProxyUploadInput,
  type RegisterAttachmentInput,
  type SignUploadInput,
} from './attachment.schema.js'
import type { AttachmentPublic, AttachmentRow } from './attachment.types.js'

function assertMime(mimeType: string): void {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new UnprocessableError('UNSUPPORTED_FILE_TYPE', 'Unsupported file type. Allowed: PDF, PNG, JPEG.')
  }
}

function assertSize(sizeBytes: number): void {
  if (sizeBytes > MAX_FILE_BYTES) {
    throw new UnprocessableError('FILE_TOO_LARGE', 'File exceeds the 10 MB limit.')
  }
}

/**
 * Enforce that `user` may see the parent entity an attachment hangs off, mirroring the parent
 * module's own read rules. NotFoundError when the parent doesn't exist (no existence leak),
 * ForbiddenError when it exists but is out of the caller's scope.
 */
export async function assertEntityVisible(
  entityType: AttachmentEntity,
  entityId: string,
  user: Claims,
): Promise<void> {
  switch (entityType) {
    case 'TRANSACTION': {
      // Admin sees everything; a member must be the charge's cardholder or
      // one of that cardholder's helpers.
      const txn = await repo.findTransactionAuth(entityId)
      if (!txn) throw new NotFoundError('Transaction not found')
      if (user.role === 'ADMIN') return
      if (txn.holderId === user.sub) return
      if (txn.holderId && (await repo.isHelperOf(txn.holderId, user.sub))) return
      throw new ForbiddenError('You do not have access to this charge.')
    }
    default: {
      // Exhaustiveness guard — unreachable for the current AttachmentEntity union.
      const _exhaustive: never = entityType
      throw new ForbiddenError(`Unsupported entity type: ${String(_exhaustive)}`)
    }
  }
}

/**
 * Reject a gcsKey that doesn't live under this entity type's prefix, so a caller can't register
 * an arbitrary/foreign object key (e.g. someone else's upload or a path-traversal key).
 * TODO: full HMAC-bind the key to the uploader/entity at sign time for a stronger guarantee;
 * the prefix check + visibility check close the practical hole.
 */
function assertKeyIntegrity(gcsKey: string, entityType: AttachmentEntity): void {
  const prefix = `${config.GCS_BUCKET_PREFIX.replace(/\/+$/, '')}/${entityType.toLowerCase()}/`
  if (!gcsKey.startsWith(prefix)) {
    throw new ValidationError(`gcsKey must start with "${prefix}".`)
  }
}

/** Proxy upload (local): validate, push the buffer to GCS, return the key + metadata (no DB row). */
export async function proxyUpload(
  body: ProxyUploadInput,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
): Promise<{ gcsKey: string; fileName: string; mimeType: string; sizeBytes: number }> {
  assertMime(file.mimetype)
  assertSize(file.size)
  const key = buildKey(body.entityType, file.originalname)
  await uploadBuffer(key, file.buffer, file.mimetype)
  return { gcsKey: key, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size }
}

/** Signed upload (prod): validate, return a pre-signed PUT URL + the key the browser uploads to. */
export async function signUpload(input: SignUploadInput): Promise<{ uploadUrl: string; gcsKey: string }> {
  assertMime(input.mimeType)
  assertSize(input.sizeBytes)
  const key = buildKey(input.entityType, input.fileName)
  const uploadUrl = await signedUploadUrl(key, input.mimeType)
  return { uploadUrl, gcsKey: key }
}

/** Register an already-uploaded object as an attachments row. */
export async function register(input: RegisterAttachmentInput, user: Claims): Promise<AttachmentPublic> {
  assertMime(input.mimeType)
  assertSize(input.sizeBytes)
  const entityType = input.entityType as AttachmentEntity
  await assertEntityVisible(entityType, input.entityId, user)
  assertKeyIntegrity(input.gcsKey, entityType)
  const row = await repo.insertAttachment({
    entityType,
    entityId: input.entityId,
    storageKey: input.gcsKey,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    uploadedBy: user.sub,
  })
  return toPublic(row)
}

export async function list(
  entityType: AttachmentEntity,
  entityId: string,
  user: Claims,
): Promise<AttachmentPublic[]> {
  await assertEntityVisible(entityType, entityId, user)
  const rows = await repo.listByEntity(entityType, entityId)
  return Promise.all(rows.map(toPublic))
}

export async function getForDownload(id: string, user: Claims): Promise<AttachmentRow> {
  const row = await repo.findById(id)
  if (!row) throw new NotFoundError('Attachment not found')
  await assertEntityVisible(row.entityType, row.entityId, user)
  return row
}

/** Signed mode → a redirect URL; proxy mode → null (caller streams the object instead). */
export async function downloadRedirectUrl(row: AttachmentRow): Promise<string | null> {
  if (!useSignedUrls()) return null
  return signedDownloadUrl(row.storageKey)
}

export function openStream(row: AttachmentRow): NodeJS.ReadableStream {
  return readStream(row.storageKey)
}

export async function remove(id: string, user: Claims): Promise<void> {
  const row = await repo.findById(id)
  if (!row) throw new NotFoundError('Attachment not found')
  // Defense in depth: caller must be able to see the parent entity...
  await assertEntityVisible(row.entityType, row.entityId, user)
  // ...AND be the uploader or an admin to delete.
  if (user.role !== 'ADMIN' && row.uploadedBy !== user.sub) {
    throw new ForbiddenError('Only the uploader or an admin can delete this attachment.')
  }
  await deleteObject(row.storageKey)
  await repo.deleteById(id)
}

export function getConfig(): { useSignedUrls: boolean } {
  return { useSignedUrls: useSignedUrls() }
}

/** Build the public shape: signed GET url in signed mode, else the proxy download route. */
async function toPublic(row: AttachmentRow): Promise<AttachmentPublic> {
  const downloadUrl = useSignedUrls()
    ? await signedDownloadUrl(row.storageKey)
    : `/api/v1/attachments/${row.id}/download`
  return { ...row, downloadUrl }
}
