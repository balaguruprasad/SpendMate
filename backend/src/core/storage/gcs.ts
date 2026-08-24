import { randomUUID } from 'node:crypto'
import { Storage, type Bucket } from '@google-cloud/storage'
import { config } from '../config/index.js'

/**
 * Lazy-initialised GCS client. Importing this module must never crash, even when GCS env vars or
 * the service-account key are absent — the client is built on first use and throws a clear error
 * only when an upload/download is actually attempted. Keeps the app bootable without GCS.
 */
let cachedStorage: Storage | null = null
let cachedBucket: Bucket | null = null

function getBucket(): Bucket {
  if (cachedBucket) return cachedBucket
  if (!config.GCS_BUCKET_NAME) {
    throw new Error('GCS is not configured: set GCS_BUCKET_NAME (and GCS_SERVICE_ACCOUNT_PATH / GCS_PROJECT_ID).')
  }
  if (!cachedStorage) {
    cachedStorage = new Storage({
      projectId: config.GCS_PROJECT_ID,
      keyFilename: config.GCS_SERVICE_ACCOUNT_PATH,
    })
  }
  cachedBucket = cachedStorage.bucket(config.GCS_BUCKET_NAME)
  return cachedBucket
}

/** True when the deployment is configured to hand out signed URLs (prod) vs proxy uploads (local). */
export function useSignedUrls(): boolean {
  return config.GCS_USE_SIGNED_URLS === true
}

/** Whether GCS is configured at all (bucket name present). */
export function isStorageConfigured(): boolean {
  return Boolean(config.GCS_BUCKET_NAME)
}

/** Configured bucket name (for status display). */
export function storageBucketName(): string | undefined {
  return config.GCS_BUCKET_NAME
}

/** Lightweight reachability probe for the health dashboard — verifies the bucket exists. */
export async function pingStorage(): Promise<void> {
  const [exists] = await getBucket().exists()
  if (!exists) throw new Error(`Bucket "${config.GCS_BUCKET_NAME}" not found or not accessible`)
}

/** Sanitise a user-supplied file name to a safe object-key segment. */
function safeName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file'
}

/** Build a collision-free object key: `${prefix}/${entityType}/${uuid}-${safeFileName}`. */
export function buildKey(entityType: string, fileName: string): string {
  const prefix = config.GCS_BUCKET_PREFIX.replace(/\/+$/, '')
  return `${prefix}/${entityType.toLowerCase()}/${randomUUID()}-${safeName(fileName)}`
}

/** v4 signed PUT URL the browser uses to upload directly to GCS (signed mode). */
export async function signedUploadUrl(key: string, contentType: string): Promise<string> {
  const [url] = await getBucket()
    .file(key)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + config.GCS_SIGNED_URL_EXPIRATION * 1000,
      contentType,
    })
  return url
}

/** v4 signed GET URL for downloading an object (signed mode).
 *  @param expirySeconds - override the default config expiry; e.g. pass 30 * 86400 for 30 days in bulk exports.
 */
export async function signedDownloadUrl(key: string, expirySeconds?: number): Promise<string> {
  const [url] = await getBucket()
    .file(key)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + (expirySeconds ?? config.GCS_SIGNED_URL_EXPIRATION) * 1000,
    })
  return url
}

/** Upload a buffer directly (proxy mode). */
export async function uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await getBucket().file(key).save(buffer, { contentType, resumable: false })
}

/** Open a read stream for an object (proxy download). */
export function readStream(key: string): NodeJS.ReadableStream {
  return getBucket().file(key).createReadStream()
}

/** Delete an object. Swallows "not found" so deleting an already-gone object is idempotent. */
export async function deleteObject(key: string): Promise<void> {
  try {
    await getBucket().file(key).delete()
  } catch (e) {
    const code = (e as { code?: number }).code
    if (code !== 404) throw e
  }
}
