/**
 * Feature-local DTOs for the notifications slice. The backend serves a
 * `{ data, meta:{ unreadCount } }` envelope from `GET /api/v1/notifications`.
 */

/** A notification as served by the API. `readAt` is null while unread. */
export interface NotificationView {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  invoiceId: string | null;
  vendorId: string | null;
  /** Where clicking the notification should navigate (already role-scoped). */
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
}

/** The list result: rows plus the unread count for the bell badge. */
export interface NotificationsResult {
  notifications: NotificationView[];
  unreadCount: number;
}
