/**
 * Maps a UserRole to the shared StatusBadge with the canonical `ROLE_LABEL`.
 * ADMIN/FINANCE read as info, ACCOUNTS/APPROVER as warning (approval gates),
 * CREATOR as muted. Server-safe (no client hooks).
 */
import type { UserRole } from "@/types";
import {
  StatusBadge,
  type StatusTone,
} from "@/components/shared/status-badge";
import { ROLE_LABEL } from "@/lib/config/navigation";

const ROLE_TONE: Record<UserRole, StatusTone> = {
  MEMBER: "muted",
  ADMIN: "info",
};

export function RoleBadge({
  role,
  label,
  className,
}: {
  role: UserRole;
  /** Override the canonical role label (e.g. "Helper" for card-less members). */
  label?: string;
  className?: string;
}) {
  return (
    <StatusBadge
      label={label ?? ROLE_LABEL[role]}
      tone={ROLE_TONE[role]}
      className={className}
    />
  );
}
