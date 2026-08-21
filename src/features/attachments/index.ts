/**
 * Public surface of the attachments feature slice. Other code imports ONLY from
 * here — components reach the backend through these hooks, never the service.
 */
export {
  useAttachments,
  useRegisterAttachment,
  useRemoveAttachment,
  useUploadController,
  useFileUploader,
  validateFile,
  type UploadItem,
  type UploadStatus,
} from "./hooks/use-attachments";

export {
  type AttachmentEntityType,
  type AttachmentRow,
  type AttachmentConfig,
  type UploadedFile,
  type RegisterInput,
} from "./types";

/** Resolve a row's downloadUrl to a browser-openable href (pure helper, no hooks). */
export { downloadHref, upload } from "./services/attachments.service";
