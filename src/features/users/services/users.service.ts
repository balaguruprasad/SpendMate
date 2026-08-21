/**
 * Users service — REAL API (`/api/v1/users`, ADMIN-only). The API wraps payloads
 * in `{ data: T }` and the fetch client returns the parsed body as-is, so we
 * unwrap `.data` here. Components never import this directly; they go through
 * the hooks in `../hooks`.
 */
import type { UserAccount } from "@/types";
import { api } from "@/lib/api/client";
import type { UserCreateInput, UserListParams, UserUpdateInput } from "../types";

/** Build the `?role=&departmentId=&activeOnly=` query string from filters. */
function toQuery(params: UserListParams): string {
  const sp = new URLSearchParams();
  if (params.role) sp.set("role", params.role);
  if (params.departmentId) sp.set("departmentId", params.departmentId);
  if (params.activeOnly) sp.set("activeOnly", "true");
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/** List users (optionally filtered by role / department / active). */
export async function listUsers(
  params: UserListParams = {},
): Promise<UserAccount[]> {
  return (await api.get<{ data: UserAccount[] }>(`/users${toQuery(params)}`)).data;
}

/** Single user by id. */
export async function getUser(id: string): Promise<UserAccount> {
  return (await api.get<{ data: UserAccount }>(`/users/${id}`)).data;
}

/** Create a user with an initial password (ADMIN). 409 on a duplicate email. */
export async function createUser(
  input: UserCreateInput,
): Promise<UserAccount> {
  return (await api.post<{ data: UserAccount }>("/users", input)).data;
}

/** Patch a user — name / role / departmentId / isActive (ADMIN). */
export async function updateUser(
  id: string,
  patch: UserUpdateInput,
): Promise<UserAccount> {
  return (await api.patch<{ data: UserAccount }>(`/users/${id}`, patch)).data;
}

/**
 * Activate / deactivate a user (ADMIN). Deactivate uses DELETE (soft); the
 * backend refuses to deactivate the caller's own account (409). Reactivate
 * uses PATCH isActive:true.
 */
export async function setUserActive(
  id: string,
  isActive: boolean,
): Promise<UserAccount> {
  if (!isActive) {
    return (await api.delete<{ data: UserAccount }>(`/users/${id}`)).data;
  }
  return (
    await api.patch<{ data: UserAccount }>(`/users/${id}`, { isActive: true })
  ).data;
}

/**
 * Reset a user's password (ADMIN). The backend hashes the new password, revokes
 * the target's existing sessions, and returns `{ success: true }` — never the
 * password or hash.
 */
export async function resetUserPassword(
  id: string,
  newPassword: string,
): Promise<void> {
  await api.patch<{ data: { success: true } }>(`/users/${id}/password`, {
    newPassword,
  });
}

/**
 * Permanently delete a user (ADMIN). The backend returns the deleted record on
 * success, or 409 `USER_HAS_ACTIVITY` when the user is referenced by financial
 * history (in which case they should be deactivated via the edit form instead).
 */
export async function deleteUser(id: string): Promise<UserAccount> {
  return (await api.delete<{ data: UserAccount }>(`/users/${id}`)).data;
}

export const usersService = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  setUserActive,
  resetUserPassword,
  deleteUser,
};
