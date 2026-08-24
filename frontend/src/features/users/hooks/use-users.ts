/**
 * TanStack Query hooks for the users slice. Queries are keyed via
 * `queryKeys.users.*`; every mutation invalidates `queryKeys.users.all` on
 * success and surfaces errors through a `sonner` toast (preferring the
 * `ApiError` message). Components consume only these hooks — never the service.
 */
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import type { UserAccount } from "@/types";
import { queryKeys } from "@/lib/api/query-keys";
import { QUERY_DEFAULTS } from "@/lib/constants";
import { ApiError } from "@/lib/api/http-error";
import { usersService } from "../services/users.service";
import type { UserCreateInput, UserListParams, UserUpdateInput } from "../types";

/** Human-readable message from any thrown error, preferring `ApiError`. */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

/** List users (with optional role / department / active filters). */
export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersService.listUsers(params),
    staleTime: QUERY_DEFAULTS.staleTime,
  });
}

/** A single user by id. */
export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.detail(id ?? ""),
    queryFn: () => usersService.getUser(id as string),
    enabled: Boolean(id),
    staleTime: QUERY_DEFAULTS.staleTime,
  });
}

/** Invalidate every users query after a mutation. */
function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
}

/** Create a user (ADMIN). */
export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation<UserAccount, unknown, UserCreateInput>({
    mutationFn: (input) => usersService.createUser(input),
    onSuccess: (user) => {
      void invalidate();
      toast.success(`${user.name} added.`);
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not create the user.")),
  });
}

interface UpdateUserVars {
  id: string;
  patch: UserUpdateInput;
}

/** Update a user (ADMIN). */
export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation<UserAccount, unknown, UpdateUserVars>({
    mutationFn: ({ id, patch }) => usersService.updateUser(id, patch),
    onSuccess: (user) => {
      void invalidate();
      toast.success(`${user.name} updated.`);
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not update the user.")),
  });
}

interface SetActiveVars {
  id: string;
  isActive: boolean;
}

/** Activate / deactivate a user (ADMIN). */
export function useSetUserActive() {
  const invalidate = useInvalidateUsers();
  return useMutation<UserAccount, unknown, SetActiveVars>({
    mutationFn: ({ id, isActive }) => usersService.setUserActive(id, isActive),
    onSuccess: (user) => {
      void invalidate();
      toast.success(
        user.isActive ? `${user.name} activated.` : `${user.name} deactivated.`,
      );
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not update the user.")),
  });
}

interface ResetPasswordVars {
  id: string;
  newPassword: string;
  /** For the success toast copy. */
  name: string;
}

/**
 * Reset a user's password (ADMIN). The target's existing sessions are revoked
 * server-side, so they must sign in again with the new password.
 */
export function useResetUserPassword() {
  return useMutation<void, unknown, ResetPasswordVars>({
    mutationFn: ({ id, newPassword }) =>
      usersService.resetUserPassword(id, newPassword),
    onSuccess: (_data, { name }) => {
      toast.success(
        `Password reset — ${name} must sign in with the new password.`,
      );
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not reset the password.")),
  });
}

/** Permanently delete a user (ADMIN). 409 if they have financial activity. */
export function useDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation<UserAccount, unknown, string>({
    mutationFn: (id) => usersService.deleteUser(id),
    onSuccess: (user) => {
      void invalidate();
      toast.success(`${user.name} deleted.`);
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not delete the user.")),
  });
}
