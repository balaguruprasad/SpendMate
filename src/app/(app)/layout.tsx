"use client";

/**
 * Authenticated route group — the client session guard. The per-role layouts
 * under this group own the app shell (sidebar + topbar + scroll) and theme.
 *   loading → centered spinner; anon → redirect to /login; authed → children.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-auth";
import { ROUTES } from "@/lib/constants";
import { Spinner } from "@/components/ui/spinner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "anon") router.replace(ROUTES.login);
  }, [status, router]);

  if (status === "authed") {
    // The per-role layouts own the full-height shell. The impersonation banner
    // is rendered inside the shell's content column (via AppTopbar) so it never
    // collides with the fixed sidebar panel.
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  // anon — redirecting.
  return null;
}
