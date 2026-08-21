"use client";

/**
 * Notification feed for the topbar bell. Each row shows title, body, relative
 * time, and an unread dot; clicking a row marks it read and (when a `linkPath`
 * is present) navigates there. A "Mark all read" action clears the feed.
 * Renders an EmptyState when there are no notifications.
 */
import Link from "next/link";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import type { NotificationView } from "../types";
import {
  useMarkAllRead,
  useMarkNotificationRead,
} from "../hooks/use-notifications";

interface NotificationListProps {
  notifications: NotificationView[];
  unreadCount: number;
  /** Called after a row is clicked (e.g. to close the popover). */
  onNavigate?: () => void;
}

export function NotificationList({
  notifications,
  unreadCount,
  onNavigate,
}: NotificationListProps) {
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title="No notifications"
        description="You're all caught up."
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Notifications</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={unreadCount === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          Mark all read
        </Button>
      </div>
      <ul className="flex max-h-96 flex-col overflow-y-auto">
        {notifications.map((notification) => {
          const isRead = Boolean(notification.readAt);
          const href = notification.linkPath ?? undefined;

          const body = (
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  isRead ? "bg-transparent" : "bg-primary",
                )}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm",
                    isRead ? "font-normal" : "font-medium",
                  )}
                >
                  {notification.title}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {notification.body}
                </p>
                <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                  {formatRelative(notification.createdAt)}
                </p>
              </div>
            </div>
          );

          function handleClick() {
            if (!isRead) markRead.mutate(notification.id);
            onNavigate?.();
          }

          return (
            <li key={notification.id} className="border-b last:border-b-0">
              {href ? (
                <Link
                  href={href}
                  onClick={handleClick}
                  className="block px-3 py-3 transition-colors hover:bg-muted/50"
                >
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleClick}
                  className="block w-full px-3 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
