/**
 * Feature-local DTOs for the attachments slice. These describe the shapes that
 * cross the service boundary (upload metadata, the registered row); the domain
 * `Attachment` lives in `@/types`.
 */

/** The entity types an attachment can hang off (SpendMate: charges only). */
export type AttachmentEntityType = "TRANSACTION";

/** Metadata for a file already uploaded to GCS, ready to register or submit in a create payload. */
export interface UploadedFile {
  gcsKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** A persisted attachment row as returned by the backend (with a resolved download URL). */
export interface AttachmentRow {
  id: string;
  entityType: AttachmentEntityType;
  entityId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
  /** Signed GET URL (signed mode) or the API stream route (proxy mode). */
  downloadUrl: string;
}

/** Upload mode reported by the backend so the client knows whether to proxy or PUT a signed URL. */
export interface AttachmentConfig {
  useSignedUrls: boolean;
}

/** Input for registering an already-uploaded object against an existing entity. */
export interface RegisterInput extends UploadedFile {
  entityType: AttachmentEntityType;
  entityId: string;
}
