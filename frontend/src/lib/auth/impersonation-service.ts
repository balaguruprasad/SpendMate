/**
 * Admin impersonation service — POST /admin/impersonate (ADMIN-only). Returns an
 * access token carrying the TARGET user's claims plus the impersonated user
 * (the admin keeps their own httpOnly refresh cookie, so they can exit back to
 * their own session via /auth/refresh). Consumed only by the AuthProvider.
 */
import { api } from "@/lib/api/client";
import type { UserRole } from "@/types";

/** Raw user shape returned by /admin/impersonate (same as /auth/me). */
export interface ImpersonateApiUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
}

export interface ImpersonateResult {
  accessToken: string;
  user: ImpersonateApiUser;
}

/** Start impersonating `userId`. Throws ApiError on 403/404/409/422. */
export async function impersonateUser(
  userId: string,
): Promise<ImpersonateResult> {
  const res = await api.post<{ data: ImpersonateResult }>(
    "/admin/impersonate",
    { userId },
  );
  return res.data;
}
