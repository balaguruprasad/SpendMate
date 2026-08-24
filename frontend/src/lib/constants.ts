/** Centralized magic values — route paths, page sizes, query defaults. */
import type { UserRole } from "@/types";

export const ROUTES = { login: "/login" } as const;

export const ROLE_BASE: Record<UserRole, string> = {
  MEMBER: "/member",
  ADMIN: "/admin",
};

export const SEGMENTS = {
  charges: "charges",
  cards: "cards",
  importTxns: "import",
  settings: "settings",
  users: "users",
  audit: "audit",
} as const;

export function stripRoleBase(pathname: string): string {
  for (const base of Object.values(ROLE_BASE)) {
    if (pathname === base) return "";
    if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length + 1);
  }
  return pathname.replace(/^\//, "");
}

export const DEFAULT_PAGE_SIZE = 20;
export const QUERY_DEFAULTS = { staleTime: 60_000, retry: 1 } as const;

export const UPLOAD = {
  acceptedMimeTypes: ["image/png", "image/jpeg", "application/pdf"],
  maxSizeBytes: 10 * 1024 * 1024,
} as const;
