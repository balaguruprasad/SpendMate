"use client";

/**
 * Sticky accent banner shown across every impersonated workspace (mounted in
 * the authenticated route-group layout). Visible only while an admin is
 * "viewing as" another user. Exit restores the admin session and returns to
 * /admin/users. Rendered in normal flow at the top of the app shell column so
 * it never overlaps the sticky topbar or the ScrollArea content.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { useSession } from "@/hooks/use-auth";
import { ROLE_LABEL } from "@/lib/config/navigation";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner() {
  const router = useRouter();
  const { isImpersonating, user, stopImpersonating } = useSession();
  const [exiting, setExiting] = useState(false);

  if (!isImpersonating || !user) return null;

  const roleLabel = ROLE_LABEL[user.role] ?? user.role;

  const handleExit = async () => {
    setExiting(true);
    try {
      await stopImpersonating();
      toast.success("Returned to admin");
      router.push("/admin/users");
    } catch {
      toast.error("Could not exit impersonation. Please try again.");
      setExiting(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-primary/30 bg-primary/15 px-4 py-2 text-sm md:px-6">
      <Eye className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 truncate text-foreground">
        Viewing as <span className="font-semibold">{user.fullName}</span> ({roleLabel})
        {" — "}
        <span className="text-muted-foreground">
          you&apos;re impersonating from your admin account.
        </span>
      </p>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-primary/40"
        disabled={exiting}
        onClick={handleExit}
      >
        Exit
      </Button>
    </div>
  );
}
