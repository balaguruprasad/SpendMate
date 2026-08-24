"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_BASE } from "@/lib/constants";
import type { UserRole } from "@/types";

/**
 * Gates a role's route tree. If the current viewer isn't this role, redirect to
 * their own workspace dashboard. (This also handles the demo persona switcher:
 * changing role from /admin/* bounces you to the matching workspace.)
 *
 * Optimistic client guard only — real authorization is server-side.
 */
export function RoleGuard({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { viewer } = useAuth();
  const allowed = viewer.role === role;

  useEffect(() => {
    if (!allowed) router.replace(`${ROLE_BASE[viewer.role]}/charges`);
  }, [allowed, viewer.role, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
