"use client";

/**
 * Topbar notification bell. Shows an unread badge (capped at 9+) over the bell,
 * and a popover listing the signed-in user's notifications. The feed polls and
 * refetches on focus via `useNotifications`; rows mark themselves read and
 * navigate to their `linkPath`, and a "Mark all read" action sits in the header.
 */
import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TableSkeleton } from "@/components/shared/loading";
import { useNotifications, NotificationList } from "@/features/notifications";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useNotifications();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          className="relative"
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.625rem] font-semibold leading-none text-primary-foreground tabular-nums">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {isLoading ? (
          <div className="p-3">
            <TableSkeleton rows={4} />
          </div>
        ) : (
          <NotificationList
            notifications={notifications}
            unreadCount={unreadCount}
            onNavigate={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
