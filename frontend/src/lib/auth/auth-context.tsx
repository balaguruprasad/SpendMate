"use client";

/**
 * Real client auth/session context. Hydrates from the Express backend
 * (email/password login → in-memory access token + httpOnly refresh cookie).
 * Roles: CREATOR / ACCOUNTS / APPROVER / FINANCE / ADMIN.
 *
 * Bootstrap on mount: POST /auth/refresh → GET /auth/me. The `api` client
 * attaches the bearer and auto-refreshes on 401.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Department, UserRole } from "@/types";
import {
  api,
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  setImpersonating,
} from "@/lib/api/client";
import { impersonateUser } from "@/lib/auth/impersonation-service";

/** Signed-in identity exposed to the app (mapped from the API `user`). */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  /** L2 routing departments for APPROVERs. TODO: derive from approval-matrix. */
  approverDepartments: Department[];
}

export type AuthStatus = "loading" | "authed" | "anon";

interface AuthValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /**
   * Change the signed-in user's own password. The session is preserved (the
   * backend does NOT revoke the caller's tokens). Throws `ApiError` on a wrong
   * current password (401 INVALID_PASSWORD) or a no-op (400 SAME_PASSWORD).
   */
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  /** True while an admin is viewing the app as another user. */
  isImpersonating: boolean;
  /** The real admin behind an impersonation session (null otherwise). */
  realUser: AuthUser | null;
  /** Start impersonating `userId` (ADMIN). Returns the impersonated user. */
  impersonate: (userId: string) => Promise<AuthUser>;
  /** Exit impersonation and restore the admin's own session. */
  stopImpersonating: () => Promise<void>;
}

/** Raw API user shape returned by /auth/login and /auth/me. */
interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
}

interface Envelope<T> {
  data: T;
}

function toAuthUser(u: ApiUser): AuthUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.name,
    role: u.role,
    departmentId: u.departmentId,
    // TODO: derive from approval-matrix; admin/non-approvers don't need it.
    approverDepartments: [],
  };
}

const AuthContext = createContext<AuthValue | null>(null);

// sessionStorage key holding the impersonated user's id so a page reload can
// resume the "view as" session (per-tab; the refresh cookie is always the
// admin's, so without this an F5 silently snaps back to the admin identity).
const IMPERSONATION_STORAGE_KEY = "mesa-finance.impersonated-user-id";

function storedImpersonationId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
}

function storeImpersonationId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id === null) window.sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  else window.sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, id);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  // The real admin behind an impersonation session; null when not impersonating.
  const [realUser, setRealUser] = useState<AuthUser | null>(null);
  // The admin's own in-memory access token, stashed while impersonating so we can
  // restore it on exit WITHOUT a direct /auth/refresh (a duplicate refresh would
  // trip the rotating-refresh reuse-detection and revoke the admin's session).
  const realAccessTokenRef = useRef<string | null>(null);

  // Bootstrap: try to resume a session via the refresh cookie. If a "view as"
  // session was active before the reload, re-impersonate the stored target so
  // an F5 doesn't silently snap back to the admin's own access.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const refreshed = await api.post<Envelope<{ accessToken: string }>>(
          "/auth/refresh",
        );
        setAccessToken(refreshed.data.accessToken);
        const me = await api.get<Envelope<ApiUser>>("/auth/me");
        if (!active) return;
        const self = toAuthUser(me.data);

        const targetId = storedImpersonationId();
        if (targetId && targetId !== self.id) {
          try {
            // Stash the admin's own token BEFORE swapping to the target's.
            const adminToken = getAccessToken();
            const res = await impersonateUser(targetId);
            if (!active) return;
            realAccessTokenRef.current = adminToken;
            setRealUser(self);
            setAccessToken(res.accessToken);
            setImpersonating(true);
            setUser(toAuthUser(res.user));
            setStatus("authed");
            return;
          } catch {
            // Target gone / no longer allowed — drop the stale marker and
            // continue as the real user.
            storeImpersonationId(null);
          }
        }
        if (!active) return;
        setUser(self);
        setStatus("authed");
      } catch {
        if (!active) return;
        clearAccessToken();
        setUser(null);
        setStatus("anon");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const res = await api.post<Envelope<{ accessToken: string; user: ApiUser }>>(
        "/auth/login",
        { email, password },
      );
      storeImpersonationId(null);
      setAccessToken(res.data.accessToken);
      const next = toAuthUser(res.data.user);
      setUser(next);
      setStatus("authed");
      // A different identity may have signed in — drop every cached query.
      queryClient.clear();
      return next;
    },
    [queryClient],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<void> => {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      // No token changes — the backend keeps the caller signed in.
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    // Clear any active impersonation so a logged-out client doesn't keep
    // suppressing the auto-refresh.
    setImpersonating(false);
    storeImpersonationId(null);
    setRealUser(null);
    try {
      await api.post("/auth/logout");
    } catch {
      // Best-effort; clear the local session regardless.
    }
    clearAccessToken();
    setUser(null);
    setStatus("anon");
    if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  /**
   * Start impersonating a user. Swaps ONLY the in-memory access token (to one
   * carrying the target's claims) + the context user; the admin's httpOnly
   * refresh cookie is untouched. Auto-refresh is suppressed while impersonating
   * (see client `setImpersonating`) so a 401 can't silently swap back to admin.
   */
  const impersonate = useCallback(
    async (userId: string): Promise<AuthUser> => {
      const res = await impersonateUser(userId);
      // Remember the current admin so we can show them in the banner / restore.
      setRealUser((prev) => prev ?? user);
      realAccessTokenRef.current = realAccessTokenRef.current ?? getAccessToken();
      setAccessToken(res.accessToken);
      setImpersonating(true);
      storeImpersonationId(res.user.id);
      const target = toAuthUser(res.user);
      setUser(target);
      setStatus("authed");
      // Everything cached so far was fetched with the ADMIN's token (including
      // /fees/access/me capabilities, staleTime 5 min) — drop it all so the
      // impersonated view refetches under the target's access.
      queryClient.clear();
      return target;
    },
    [user, queryClient],
  );

  /**
   * Exit impersonation. We restore the admin's stashed in-memory access token
   * and reload their identity via /auth/me — the api client will auto-refresh
   * ONCE (now un-suppressed) if that token has since expired. We deliberately
   * avoid a direct /auth/refresh here: a duplicate refresh races the rotating
   * refresh-token reuse-detection and would revoke the admin's whole session.
   */
  const stopImpersonating = useCallback(async (): Promise<void> => {
    // Lift the suppression first so the me/refresh calls behave normally.
    setImpersonating(false);
    storeImpersonationId(null);
    const adminToken = realAccessTokenRef.current;
    try {
      if (adminToken) setAccessToken(adminToken);
      const me = await api.get<Envelope<ApiUser>>("/auth/me");
      setUser(toAuthUser(me.data));
    } catch {
      // Stashed token gone/expired and the single auto-refresh failed — fall
      // back to one explicit refresh from the admin's cookie.
      const refreshed = await api.post<Envelope<{ accessToken: string }>>(
        "/auth/refresh",
      );
      setAccessToken(refreshed.data.accessToken);
      const me = await api.get<Envelope<ApiUser>>("/auth/me");
      setUser(toAuthUser(me.data));
    }
    realAccessTokenRef.current = null;
    setRealUser(null);
    setStatus("authed");
    // Mirror of impersonate(): the cache is full of the TARGET's data — clear
    // it so the admin's own view refetches under their restored access.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      login,
      logout,
      changePassword,
      isImpersonating: realUser !== null,
      realUser,
      impersonate,
      stopImpersonating,
    }),
    [
      status,
      user,
      login,
      logout,
      changePassword,
      realUser,
      impersonate,
      stopImpersonating,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Raw context (nullable user). For the login page and the app auth guard. */
export function useSessionContext(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useSession must be used within <AuthProvider>");
  return ctx;
}
