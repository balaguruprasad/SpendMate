/**
 * Transport types — the shapes that cross the REST boundary to the Express API.
 */

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Backend error envelope; surfaced through ApiError. */
export interface ApiErrorBody {
  message: string;
  code?: string;
  details?: unknown;
}

/** Signed URL pair for direct-to-GCS receipt uploads. */
export interface SignedUpload {
  uploadUrl: string;
  gcsKey: string;
  expiresAt: string;
}
