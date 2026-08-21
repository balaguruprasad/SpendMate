import type { AttachmentEntity } from '../../core/db/types.js'

/** A persisted attachments row (DB-shaped, dates resolved). */
export interface AttachmentRow {
  id: string
  entityType: AttachmentEntity
  entityId: string
  storageKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string | null
  createdAt: Date
}

/** An attachment as returned to clients — adds a resolved download URL. */
export interface AttachmentPublic extends AttachmentRow {
  downloadUrl: string
}
