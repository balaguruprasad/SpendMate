/**
 * TanStack Query hooks for the notifications slice. The list is keyed via
 * `queryKeys.notifications.list()` and refetches on window focus plus a gentle
 * interval so the bell badge stays fresh; mutations invalidate the list on
 * success. Errors surface through a `sonner` toast. Components consume only
 * these hooks — never the service directly.
 */
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError } from "@/lib/api/http-error";
import { notificationsService } from "../services/notifications.service";

/** Refetch the bell feed roughly once a minute. */
const POLL_INTERVAL_MS = 60_000;

/** Human-readable message from any thrown error, preferring `ApiError`. */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

/** The signed-in user's notifications + unread count, kept fresh by polling. */
export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => notificationsService.list(),
    refetchOnWindowFocus: true,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 0,
  });
}

/** Mark a single notification read. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => notificationsService.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not update the notification.")),
  });
}

/** Mark every notification for the signed-in user read. */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation<number, unknown, void>({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: (count) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      if (count > 0) toast.success("All notifications marked read.");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not update notifications.")),
  });
}
