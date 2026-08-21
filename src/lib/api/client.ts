/**
 * Typed fetch wrapper. Prefixes the API base URL, attaches the in-memory bearer
 * access token, sends the httpOnly refresh cookie (cross-origin), parses JSON,
 * and throws ApiError on non-2xx. On a 401 it transparently refreshes the access
 * token once (POST /auth/refresh) and retries the original request.
 */
import { env } from "@/lib/config/env";
import { ApiError } from "./http-error";

/** In-memory access token (never persisted; refresh lives in an httpOnly cookie). */
let accessToken: string | null = null;

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}

/**
 * Impersonation guard. While an admin is impersonating a user, the in-memory
 * access token belongs to the TARGET. A 401 → /auth/refresh would mint a fresh
 * ADMIN token (the refresh cookie is still the admin's), silently desyncing the
 * UI from the token. So while impersonating we suppress the auto-refresh+retry
 * and surface the 401 instead. The AuthProvider toggles this flag.
 */
let impersonating = false;

export function setImpersonating(value: boolean): void {
  impersonating = value;
}

interface RefreshResponse {
  data: { accessToken: string };
}

/** Shared in-flight refresh so concurrent 401s trigger a single refresh call. */
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as RefreshResponse;
        const token = body.data?.accessToken ?? null;
        if (token) setAccessToken(token);
        return token;
      } catch {
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

function buildInit(init: RequestInit): RequestInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return {
    ...init,
    // Send the httpOnly refresh cookie on cross-origin API calls.
    credentials: "include",
    headers,
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isAuthFlow = path === "/auth/refresh" || path === "/auth/login";

  let res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`, buildInit(init));

  if (res.status === 401 && !isAuthFlow && !impersonating) {
    const error = await ApiError.fromResponse(res.clone());
    const token = await refreshAccessToken();
    if (token) {
      // Retry the original request once with the fresh token.
      res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`, buildInit(init));
      if (res.ok) {
        return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
      }
      throw await ApiError.fromResponse(res);
    }
    // Refresh failed — drop the session and bounce to login (browser only).
    clearAccessToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw error;
  }

  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/**
 * Multipart upload — sends a `FormData` body so the browser sets the multipart
 * Content-Type + boundary itself (the JSON `request` helper would clobber it).
 * Attaches the bearer token + refresh cookie and throws `ApiError` on non-2xx.
 * No auto-refresh/retry: a streamed file body can't be safely replayed; callers
 * re-trigger the upload if the session lapsed.
 */
/** Authenticated binary GET (attachment downloads) — returns the raw Blob. */
async function getBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    credentials: "include",
    headers,
  });
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.blob();
}

async function upload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  });
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(p: string) => request<T>(p, { method: "DELETE" }),
  getBlob,
  upload,
};

/** True while running against the in-memory mock backend. */
export const USE_MOCK = env.NEXT_PUBLIC_USE_MOCK;
