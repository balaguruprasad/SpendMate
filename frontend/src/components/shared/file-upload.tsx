"use client";

/**
 * Reusable multi-file uploader (drag/drop + picker) backed by the attachments
 * slice. Two modes:
 *  - collect (no `entityId`): files are uploaded to GCS as picked; the resolved
 *    `UploadedFile[]` is surfaced via `value` / `onChange` so a create form can
 *    submit them in its create payload (the entity doesn't exist yet).
 *  - existing entity (`entityId` set): each upload is registered immediately via
 *    POST /attachments and the component reflects the server list, with a remove
 *    (✕) that calls DELETE.
 * Each file is validated client-side (PDF/PNG/JPEG, ≤ 10 MB) before upload; the
 * upload mode (proxy vs signed) is resolved by the service from the backend.
 *
 * Uploads report ACTUAL progress (XHR `upload.onprogress`, via the service's
 * `uploadWithProgress`). The component owns a per-picked-file row with a live
 * progress bar and uploaded / error states (with retry).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  RotateCw,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/format";
import { UPLOAD } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { attachmentsService } from "@/features/attachments/services/attachments.service";
import {
  useAttachments,
  useFileUploader,
  useRegisterAttachment,
  useRemoveAttachment,
  validateFile,
  type AttachmentEntityType,
  type AttachmentRow,
  type UploadedFile,
} from "@/features/attachments";

interface FileUploadProps {
  entityType: AttachmentEntityType;
  /** When set, uploads register immediately against this entity (existing-entity mode). */
  entityId?: string;
  /** Collect-mode controlled value: files uploaded but not yet attached to an entity. */
  value?: UploadedFile[];
  onChange?: (files: UploadedFile[]) => void;
  /** Hide the picker/dropzone (e.g. a read-only viewer who can't edit). */
  readOnly?: boolean;
  /** Slim single-row dropzone for tight dialogs. */
  compact?: boolean;
  className?: string;
}

const ACCEPT = UPLOAD.acceptedMimeTypes.join(",");

type RowStatus = "uploading" | "done" | "error";

/** A locally-tracked picked file (in collect or existing mode). */
interface PendingRow {
  localId: string;
  file: File;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  status: RowStatus;
  progress: number;
  error?: string;
  /** Object URL for an image preview thumbnail (revoked on unmount). */
  previewUrl?: string;
  /** Resolved once the upload to GCS succeeds. */
  uploaded?: UploadedFile;
}

let counter = 0;
const nextLocalId = () => `up-${Date.now()}-${counter++}`;

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/** 40px type-icon tile: a thumbnail for images, else a tinted lucide glyph. */
function TypeIcon({
  mimeType,
  previewUrl,
  fileName,
}: {
  mimeType: string;
  previewUrl?: string;
  fileName?: string;
}) {
  if (isImage(mimeType)) {
    if (previewUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={fileName ? `Preview of ${fileName}` : "Image preview"}
          className="size-10 shrink-0 rounded-md object-cover"
        />
      );
    }
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <ImageIcon className="size-5" aria-hidden />
      </span>
    );
  }
  // Treat everything else (PDF) as a document tile.
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
      <FileText className="size-5" aria-hidden />
      <span className="sr-only">PDF</span>
    </span>
  );
}

export function FileUpload({
  entityType,
  entityId,
  value = [],
  onChange,
  readOnly = false,
  compact = false,
  className,
}: FileUploadProps) {
  const isExisting = Boolean(entityId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<PendingRow[]>([]);

  const { upload } = useFileUploader(entityType);
  const register = useRegisterAttachment();
  const attachments = useAttachments(entityType, entityId);
  const removeAttachment = useRemoveAttachment(entityType, entityId);

  // Latest controlled value, so async upload callbacks append without stale closures.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Revoke any image preview object URLs on unmount.
  useEffect(() => {
    return () => {
      setRows((prev) => {
        prev.forEach((r) => r.previewUrl && URL.revokeObjectURL(r.previewUrl));
        return prev;
      });
    };
  }, []);

  const patchRow = useCallback((localId: string, patch: Partial<PendingRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)),
    );
  }, []);

  const runUpload = useCallback(
    async (localId: string, file: File) => {
      patchRow(localId, { status: "uploading", progress: 0, error: undefined });
      try {
        const uploaded = await upload(file, (pct) =>
          patchRow(localId, { progress: pct }),
        );
        patchRow(localId, { status: "done", progress: 100, uploaded });
        if (isExisting && entityId) {
          register.mutate({ ...uploaded, entityType, entityId });
        } else {
          onChangeRef.current?.([...valueRef.current, uploaded]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed.";
        patchRow(localId, { status: "error", error: message });
        toast.error(`${file.name}: ${message}`);
      }
    },
    [upload, patchRow, isExisting, entityId, entityType, register],
  );

  const ingest = useCallback(
    (files: File[]) => {
      if (readOnly || files.length === 0) return;
      for (const file of files) {
        const localId = nextLocalId();
        const validationError = validateFile(file);
        const previewUrl =
          isImage(file.type) && !validationError
            ? URL.createObjectURL(file)
            : undefined;

        if (validationError) {
          setRows((prev) => [
            ...prev,
            {
              localId,
              file,
              fileName: file.name,
              sizeBytes: file.size,
              mimeType: file.type,
              status: "error",
              progress: 0,
              error: validationError,
            },
          ]);
          toast.error(`${file.name}: ${validationError}`);
          continue;
        }

        setRows((prev) => [
          ...prev,
          {
            localId,
            file,
            fileName: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
            status: "uploading",
            progress: 0,
            previewUrl,
          },
        ]);
        void runUpload(localId, file);
      }
    },
    [readOnly, runUpload],
  );

  function onPicked(event: React.ChangeEvent<HTMLInputElement>) {
    ingest(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (readOnly) return;
    ingest(Array.from(event.dataTransfer.files ?? []));
  }

  function retryRow(row: PendingRow) {
    if (validateFile(row.file)) return; // invalid files aren't retryable
    void runUpload(row.localId, row.file);
  }

  function dropRow(localId: string) {
    setRows((prev) => {
      const row = prev.find((r) => r.localId === localId);
      if (row?.uploaded && !isExisting) {
        onChangeRef.current?.(
          valueRef.current.filter((f) => f.gcsKey !== row.uploaded!.gcsKey),
        );
      }
      if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((r) => r.localId !== localId);
    });
  }

  const serverRows = attachments.data ?? [];
  // In existing-entity mode, completed uploads are owned by the server list —
  // hide the local "done" row so it isn't shown twice.
  const visibleRows = rows.filter((r) => !(isExisting && r.status === "done"));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={onPicked}
      />

      {!readOnly && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload files"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "cursor-pointer rounded-xl border-2 border-dashed transition-colors outline-none",
            "hover:border-primary/60 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            dragging ? "border-primary bg-primary/5" : "border-border/70",
            compact
              ? "flex items-center gap-2.5 px-3 py-2"
              : "flex flex-col items-center justify-center gap-3 px-6 py-8 text-center",
          )}
        >
          <span
            className={cn(
              "flex items-center justify-center rounded-full transition-colors",
              compact ? "size-7" : "size-11",
              dragging
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            <UploadCloud className={compact ? "size-3.5" : "size-5"} aria-hidden />
          </span>
          {compact ? (
            <span className="min-w-0 truncate text-xs">
              <span className="font-semibold text-primary">Upload proof</span>{" "}
              <span className="text-muted-foreground">— drop or click · PDF/PNG/JPG, 10 MB</span>
            </span>
          ) : (
            <>
              <span className="text-sm">
                <span className="font-semibold">Drag &amp; drop files here</span>{" "}
                or <span className="font-semibold text-primary">click to upload</span>
              </span>
              <span className="text-xs text-muted-foreground">
                PDF, PNG or JPG · up to 10 MB
              </span>
            </>
          )}
        </div>
      )}

      {(serverRows.length > 0 || visibleRows.length > 0) && (
        <ul className="flex flex-col gap-2">
          {/* Persisted rows (existing-entity mode). */}
          {serverRows.map((row) => (
            <ServerFileRow
              key={row.id}
              row={row}
              readOnly={readOnly}
              removing={removeAttachment.isPending}
              onRemove={() => removeAttachment.mutate(row.id)}
            />
          ))}

          {/* Locally-tracked picked files (uploading / done in collect mode / error). */}
          {visibleRows.map((row) => (
            <li
              key={row.localId}
              className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm"
            >
              <TypeIcon
                mimeType={row.mimeType}
                previewUrl={row.previewUrl}
                fileName={row.fileName}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{row.fileName}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {formatFileSize(row.sizeBytes)}
                  </span>
                </div>

                {row.status === "uploading" && (
                  <Progress value={row.progress} className="h-1.5" />
                )}
                {row.status === "done" && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" aria-hidden /> Uploaded
                  </span>
                )}
                {row.status === "error" && (
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs text-destructive">
                      {row.error ?? "Upload failed."}
                    </span>
                    {!validateFile(row.file) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="shrink-0 text-muted-foreground"
                        onClick={() => retryRow(row)}
                      >
                        <RotateCw className="size-3" aria-hidden />
                        Retry
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {row.status === "uploading" && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {row.progress}%
                  </span>
                )}
                {row.status === "done" && (
                  <CheckCircle2
                    className="size-4 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                )}
                {row.status === "error" && (
                  <AlertCircle className="size-4 text-destructive" aria-hidden />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${row.fileName}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => dropRow(row.localId)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isExisting && attachments.isLoading && (
        <p className="text-xs text-muted-foreground">Loading attachments…</p>
      )}
    </div>
  );
}

/**
 * A persisted attachment row (existing-entity mode). Resolves the row's
 * `downloadUrl` to a browser-openable href on demand (proxy URLs need a bearer
 * token, so they're fetched as a blob); shows a Download button in readOnly mode
 * and a remove (✕) otherwise.
 */
function ServerFileRow({
  row,
  readOnly,
  removing,
  onRemove,
}: {
  row: AttachmentRow;
  readOnly: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHref, setPreviewHref] = useState<string | null>(null);

  async function openDownload() {
    setDownloading(true);
    try {
      const href = await attachmentsService.downloadHref(row);
      window.open(href, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not open the file.",
      );
    } finally {
      setDownloading(false);
    }
  }

  async function openPreview() {
    setPreviewing(true);
    try {
      const href = await attachmentsService.downloadHref(row);
      setPreviewHref(href);
      setPreviewOpen(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load the preview.",
      );
    } finally {
      setPreviewing(false);
    }
  }

  function closePreview() {
    setPreviewOpen(false);
    // Revoke blob URL after dialog closes to free memory
    if (previewHref && previewHref.startsWith("blob:")) {
      URL.revokeObjectURL(previewHref);
      setPreviewHref(null);
    }
  }

  const isPdf = row.mimeType === "application/pdf";
  const isImg = isImage(row.mimeType);

  return (
    <>
      <li className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm">
        <TypeIcon mimeType={row.mimeType} fileName={row.fileName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{row.fileName}</span>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(row.sizeBytes)}
          </span>
        </div>
        {readOnly ? (
          <div className="flex shrink-0 items-center gap-1">
            {(isPdf || isImg) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={previewing}
                aria-label={`View ${row.fileName}`}
                className="text-muted-foreground"
                onClick={() => void openPreview()}
              >
                <Eye className="size-4" aria-hidden />
                View
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={downloading}
              aria-label={`Download ${row.fileName}`}
              className="text-muted-foreground"
              onClick={() => void openDownload()}
            >
              <Download className="size-4" aria-hidden />
              Download
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${row.fileName}`}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            disabled={removing}
            onClick={onRemove}
          >
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </li>

      {previewHref && (
        <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) closePreview(); }}>
          <DialogContent className="w-[95vw] max-w-4xl gap-0 p-0 overflow-hidden">
            <DialogHeader className="px-4 py-3 border-b border-border">
              <DialogTitle className="truncate text-sm font-medium">{row.fileName}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center bg-muted/30" style={{ minHeight: "60vh" }}>
              {isImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewHref}
                  alt={row.fileName}
                  className="max-w-full max-h-[75vh] object-contain"
                />
              ) : (
                <iframe
                  src={previewHref}
                  title={row.fileName}
                  className="w-full border-0"
                  style={{ height: "75vh" }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
