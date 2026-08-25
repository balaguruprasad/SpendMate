/**
 * Attachments service — adapter over the REAL backend API (`/api/v1/attachments`).
 *
 * Two upload modes, chosen by the backend's `/attachments/config`:
 *  - proxy (local default): POST the file multipart to `/attachments/upload`;
 *    the API streams it to GCS and returns the object key.
 *  - signed (prod): POST metadata to `/attachments/sign` for a pre-signed PUT
 *    URL, then PUT the file bytes straight to GCS.
 * Both yield an `UploadedFile` the caller can submit in a create payload or
 * register against an existing entity. React-free + typed; components consume
 * the hooks in `../hooks`.
 */
import { api } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/client";
import { env } from "@/lib/config/env";
import type {
  AttachmentConfig,
  AttachmentEntityType,
  AttachmentRow,
  RegisterInput,
  UploadedFile,
} from "../types";

/** Cache the upload-mode lookup once per module lifetime (it never changes per deployment). */
let configPromise: Promise<AttachmentConfig> | null = null;

export function getConfig(): Promise<AttachmentConfig> {
  if (!configPromise) {
    configPromise = api
      .get<{ data: AttachmentConfig }>("/attachments/config")
      .then(({ data }) => data)
      .catch((error) => {
        configPromise = null; // don't cache a failure
        throw error;
      });
  }
  return configPromise;
}

/** Proxy upload (local): multipart POST; the API pushes the buffer to GCS. */
async function uploadProxy(
  file: File,
  entityType: AttachmentEntityType,
): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", file);
  form.append("entityType", entityType);
  const { data } = await api.upload<{ data: UploadedFile }>(
    "/attachments/upload",
    form,
  );
  return data;
}

/** Request a pre-signed PUT URL (signed/prod mode). */
async function signUpload(input: {
  file: File;
  entityType: AttachmentEntityType;
}): Promise<{ uploadUrl: string; gcsKey: string }> {
  const { data } = await api.post<{ data: { uploadUrl: string; gcsKey: string } }>(
    "/attachments/sign",
    {
      entityType: input.entityType,
      fileName: input.file.name,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
    },
  );
  return data;
}

/** Signed upload (prod): get a signed URL then PUT the bytes straight to GCS. */
async function uploadSigned(
  file: File,
  entityType: AttachmentEntityType,
): Promise<UploadedFile> {
  const { uploadUrl, gcsKey } = await signUpload({ file, entityType });
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload to storage failed (${res.status}).`);
  }
  return { gcsKey, fileName: file.name, mimeType: file.type, sizeBytes: file.size };
}

/** Once a direct-to-GCS PUT dies on CORS/network, stick to proxy uploads for
 * the session — the API route works without any bucket CORS config. */
let signedBlocked = false;

function isNetworkError(e: unknown): boolean {
  return (
    e instanceof TypeError ||
    (e instanceof Error && /failed to fetch|network error/i.test(e.message))
  );
}

/** Upload a single file using whichever mode the backend reports. */
export async function upload(
  file: File,
  entityType: AttachmentEntityType,
): Promise<UploadedFile> {
  const { useSignedUrls } = await getConfig();
  if (useSignedUrls && !signedBlocked) {
    try {
      return await uploadSigned(file, entityType);
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      signedBlocked = true; // CORS-blocked bucket — fall through to proxy
    }
  }
  return uploadProxy(file, entityType);
}

/** Reported upload progress as a whole-number percentage (0–100). */
type ProgressFn = (pct: number) => void;

/** Parse a `{ error: { message } }` envelope from an XHR response, falling back. */
function xhrErrorMessage(xhr: XMLHttpRequest, fallback: string): string {
  try {
    const body = JSON.parse(xhr.responseText) as {
      error?: { message?: string };
      message?: string;
    };
    return body.error?.message ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Proxy upload with real progress. Multipart POST to `/attachments/upload` via
 * `XMLHttpRequest` (the only browser API that reports `upload.onprogress`);
 * carries the bearer token + refresh cookie like `api.upload`. Resolves the
 * returned `UploadedFile`; maps non-2xx to an `Error` (parsing the envelope).
 */
function uploadProxyWithProgress(
  file: File,
  entityType: AttachmentEntityType,
  onProgress: ProgressFn,
  signal?: AbortSignal,
): Promise<UploadedFile> {
  return new Promise<UploadedFile>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("entityType", entityType);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${env.NEXT_PUBLIC_API_BASE_URL}/attachments/upload`);
    xhr.withCredentials = true;
    const token = getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // Don't set Content-Type — the browser adds the multipart boundary itself.

    wireXhr(xhr, onProgress, signal, {
      onSuccess: () => {
        try {
          const body = JSON.parse(xhr.responseText) as { data: UploadedFile };
          resolve(body.data);
        } catch {
          reject(new Error("Upload succeeded but the response was unreadable."));
        }
      },
      onError: reject,
    });

    xhr.send(form);
  });
}

/**
 * Signed upload with real progress. Asks the API to sign a PUT, then streams the
 * raw file bytes straight to GCS via `XMLHttpRequest` with `upload.onprogress`.
 */
async function uploadSignedWithProgress(
  file: File,
  entityType: AttachmentEntityType,
  onProgress: ProgressFn,
  signal?: AbortSignal,
): Promise<UploadedFile> {
  const { uploadUrl, gcsKey } = await signUpload({ file, entityType });
  return new Promise<UploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    // No bearer/cookies here — the signature in the URL authorizes the PUT.

    wireXhr(xhr, onProgress, signal, {
      onSuccess: () =>
        resolve({
          gcsKey,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      onError: reject,
    });

    xhr.send(file);
  });
}

/** Shared XHR wiring: progress, success/error mapping, and abort support. */
function wireXhr(
  xhr: XMLHttpRequest,
  onProgress: ProgressFn,
  signal: AbortSignal | undefined,
  handlers: { onSuccess: () => void; onError: (err: Error) => void },
): void {
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      onProgress(Math.round((event.loaded / event.total) * 100));
    }
  };
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      onProgress(100);
      handlers.onSuccess();
    } else {
      handlers.onError(
        new Error(xhrErrorMessage(xhr, `Upload failed (${xhr.status}).`)),
      );
    }
  };
  xhr.onerror = () => handlers.onError(new Error("Network error during upload."));
  xhr.onabort = () => handlers.onError(new Error("Upload cancelled."));

  if (signal) {
    if (signal.aborted) {
      xhr.abort();
      return;
    }
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
  }
}

/**
 * Upload a single file and report ACTUAL progress (0–100) via `onProgress`.
 * Uses `XMLHttpRequest` (plain `fetch` can't surface upload progress); picks the
 * proxy or signed branch from the cached backend config. Pass an `AbortSignal`
 * to cancel an in-flight upload.
 */
export async function uploadWithProgress(
  file: File,
  entityType: AttachmentEntityType,
  onProgress: ProgressFn,
  signal?: AbortSignal,
): Promise<UploadedFile> {
  const { useSignedUrls } = await getConfig();
  if (useSignedUrls && !signedBlocked) {
    try {
      return await uploadSignedWithProgress(file, entityType, onProgress, signal);
    } catch (e) {
      if (!isNetworkError(e) || signal?.aborted) throw e;
      signedBlocked = true; // CORS-blocked bucket — retry through the API
      onProgress(0);
    }
  }
  return uploadProxyWithProgress(file, entityType, onProgress, signal);
}

/** Register an already-uploaded object as an attachment row on an existing entity. */
export async function register(input: RegisterInput): Promise<AttachmentRow> {
  const { data } = await api.post<{ data: AttachmentRow }>("/attachments", input);
  return data;
}

/** List attachments for an entity (each with a resolved download URL). */
export async function list(
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<AttachmentRow[]> {
  const query = new URLSearchParams({ entityType, entityId });
  const { data } = await api.get<{ data: AttachmentRow[] }>(
    `/attachments?${query.toString()}`,
  );
  return data;
}

/** Delete an attachment by id (uploader or ADMIN; backend enforces). */
export async function remove(id: string): Promise<void> {
  await api.delete<void>(`/attachments/${id}`);
}

/**
 * Resolve a row's `downloadUrl` to something a browser can open. Signed URLs are
 * absolute (open as-is); the proxy route is API-relative and needs the API base
 * URL + a bearer token, so we fetch it as a blob and hand back an object URL.
 */
export async function downloadHref(row: AttachmentRow): Promise<string> {
  if (/^https?:\/\//i.test(row.downloadUrl)) return row.downloadUrl;
  const token = getAccessToken();
  const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${stripApiPrefix(row.downloadUrl)}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** The backend returns `/api/v1/attachments/...`; the API base already ends at `/api/v1`. */
function stripApiPrefix(path: string): string {
  return path.replace(/^\/api\/v1/, "");
}

export const attachmentsService = {
  getConfig,
  upload,
  uploadWithProgress,
  register,
  list,
  remove,
  downloadHref,
};
