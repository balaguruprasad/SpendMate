"use client";

import { useSessionContext, type AuthUser } from "@/lib/auth/auth-context";
import type { UserRole } from "@/types";

/** Raw session: `{ status, user (nullable), login, logout }`. For the login
 *  page and the app auth guard. */
export function useSession() {
  return useSessionContext();
}

interface Viewer {
  id: string;
  role: UserRole;
}

/**
 * Asserts an authenticated session and returns a NON-NULL user. Only call from
 * inside the authenticated route group — the app guard guarantees children
 * render only once `status === "authed"`.
 */
export function useAuth(): {
  user: AuthUser;
  viewer: Viewer;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  isImpersonating: boolean;
  realUser: AuthUser | null;
  impersonate: (userId: string) => Promise<AuthUser>;
  stopImpersonating: () => Promise<void>;
} {
  const {
    user,
    logout,
    changePassword,
    isImpersonating,
    realUser,
    impersonate,
    stopImpersonating,
  } = useSessionContext();
  if (!user) throw new Error("useAuth used outside an authenticated session");
  return {
    user,
    viewer: { id: user.id, role: user.role },
    logout,
    changePassword,
    isImpersonating,
    realUser,
    impersonate,
    stopImpersonating,
  };
}
