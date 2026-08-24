/**
 * TanStack Query hooks for the attachments slice. `useAttachments` lists the
 * rows for an entity; `useRegisterAttachment` / `useRemoveAttachment` mutate and
 * invalidate that list; `useUploadController` drives the per-file upload state
 * for the `FileUpload` component (validation + GCS upload, mode-agnostic).
 * Components consume only these hooks — never the service directly.
 */
"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { queryKeys } from "@/lib/api/query-keys";
import { QUERY_DEFAULTS, UPLOAD } from "@/lib/constants";
import { ApiError } from "@/lib/api/http-error";
import { attachmentsService } from "../services/attachments.service";
import type {
  AttachmentEntityType,
  AttachmentRow,
  RegisterInput,
  UploadedFile,
} from "../types";

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

/** Client-side validation mirroring the backend (PDF/PNG/JPEG, ≤ 10 MB). */
export function validateFile(file: File): string | null {
  if (!(UPLOAD.acceptedMimeTypes as readonly string[]).includes(file.type)) {
    return "Unsupported file type. Allowed: PDF, PNG, JPEG.";
  }
  if (file.size > UPLOAD.maxSizeBytes) {
    return "File exceeds the 10 MB limit.";
  }
  return null;
}

/** List attachments for an entity (enabled only when both keys are present). */
export function useAttachments(
  entityType: AttachmentEntityType,
  entityId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.attachments.list(entityType, entityId ?? ""),
    queryFn: () => attachmentsService.list(entityType, entityId as string),
    enabled: Boolean(entityId),
    staleTime: QUERY_DEFAULTS.staleTime,
  });
}

/** Register an already-uploaded object against an existing entity. */
export function useRegisterAttachment() {
  const queryClient = useQueryClient();
  return useMutation<AttachmentRow, unknown, RegisterInput>({
    mutationFn: (input) => attachmentsService.register(input),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.list(row.entityType, row.entityId),
      });
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not attach the file.")),
  });
}

/** Delete an attachment, then refresh the owning entity's list. */
export function useRemoveAttachment(
  entityType: AttachmentEntityType,
  entityId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => attachmentsService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.list(entityType, entityId ?? ""),
      });
      toast.success("Attachment removed.");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not remove the attachment.")),
  });
}

/** Per-file upload status tracked by the FileUpload component. */
export type UploadStatus = "uploading" | "done" | "error";

export interface UploadItem {
  /** Stable client id for list keys. */
  localId: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  status: UploadStatus;
  error?: string;
  /** Set once the upload to GCS succeeds. */
  uploaded?: UploadedFile;
}

let counter = 0;
const nextLocalId = () => `up-${Date.now()}-${counter++}`;

/**
 * Drives multi-file upload state for `FileUpload`. Validates each file, uploads
 * it to GCS (mode chosen by the service), and tracks per-file status. Callers
 * read `items` (UI) and the resolved `UploadedFile`s via the `onUploaded` cb.
 */
export function useUploadController(entityType: AttachmentEntityType) {
  const [items, setItems] = useState<UploadItem[]>([]);

  const update = useCallback((localId: string, patch: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it)),
    );
  }, []);

  const addFiles = useCallback(
    async (files: File[], onUploaded?: (file: UploadedFile) => void) => {
      for (const file of files) {
        const localId = nextLocalId();
        const error = validateFile(file);
        if (error) {
          setItems((prev) => [
            ...prev,
            {
              localId,
              fileName: file.name,
              sizeBytes: file.size,
              mimeType: file.type,
              status: "error",
              error,
            },
          ]);
          toast.error(`${file.name}: ${error}`);
          continue;
        }
        setItems((prev) => [
          ...prev,
          {
            localId,
            fileName: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
            status: "uploading",
          },
        ]);
        try {
          const uploaded = await attachmentsService.upload(file, entityType);
          update(localId, { status: "done", uploaded });
          onUploaded?.(uploaded);
        } catch (err) {
          update(localId, {
            status: "error",
            error: errorMessage(err, "Upload failed."),
          });
          toast.error(`${file.name}: ${errorMessage(err, "Upload failed.")}`);
        }
      }
    },
    [entityType, update],
  );

  const removeItem = useCallback((localId: string) => {
    setItems((prev) => prev.filter((it) => it.localId !== localId));
  }, []);

  const reset = useCallback(() => setItems([]), []);

  return { items, addFiles, removeItem, reset };
}

/**
 * Lightweight uploader for the redesigned `FileUpload` component: the component
 * owns its per-file row state, so this hook just exposes a stable, awaitable
 * `upload(file, onProgress)` (real XHR progress, mode-agnostic) bound to the
 * entity type. `validateFile` is re-exported above for the component's
 * pre-upload type/size check.
 */
export function useFileUploader(entityType: AttachmentEntityType) {
  const upload = useCallback(
    (file: File, onProgress: (pct: number) => void, signal?: AbortSignal) =>
      attachmentsService.uploadWithProgress(file, entityType, onProgress, signal),
    [entityType],
  );
  return { upload };
}
