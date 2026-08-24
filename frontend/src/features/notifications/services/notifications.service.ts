/**
 * Notifications service — talks to the real backend (`/api/v1/notifications`).
 * The fetch client returns the parsed `{ data, meta }` envelope as-is. The list
 * carries an `unreadCount` in `meta`; mark-read endpoints flip `readAt`.
 * React-free + typed; components consume only the hooks in `../hooks`.
 */
import { api } from "@/lib/api/client";
import type { NotificationsResult, NotificationView } from "../types";

/** The signed-in user's notifications, newest first, plus the unread count. */
export async function list(): Promise<NotificationsResult> {
  const body = await api.get<{
    data: NotificationView[];
    meta?: { unreadCount?: number };
  }>("/notifications");
  return {
    notifications: body.data,
    unreadCount: body.meta?.unreadCount ?? 0,
  };
}

/** Mark a single notification read. */
export async function markRead(id: string): Promise<void> {
  await api.patch<{ data: NotificationView }>(`/notifications/${id}/read`);
}

/** Mark every notification for the signed-in user read; returns the count updated. */
export async function markAllRead(): Promise<number> {
  const { data } = await api.post<{ data: { updated: number } }>(
    "/notifications/read-all",
  );
  return data.updated;
}

export const notificationsService = { list, markRead, markAllRead };
