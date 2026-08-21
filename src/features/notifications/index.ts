/**
 * Public surface of the notifications feature slice. Other code imports ONLY
 * from here — never from `./services/*` (components reach the API through hooks).
 */
export {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllRead,
} from "./hooks/use-notifications";

export { NotificationList } from "./components/notification-list";

export type { NotificationView, NotificationsResult } from "./types";
