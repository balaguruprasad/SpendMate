import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROLE_BASE, ROUTES } from "@/lib/constants";

/**
 * Optimistic auth/role gate. In mock mode there is no server-side session
 * (identity lives in client React state), so this stays deliberately minimal:
 *
 * - The bare `/` is sent to the login / persona picker.
 * - A bare role base (e.g. `/admin`, `/creator`) is forwarded to that role's
 *   dashboard (there is no index page at the role base itself).
 * - Every other role sub-route passes straight through.
 *
 * When real auth lands, read the session cookie here and redirect missing
 * sessions to `/login` and cross-role paths to `ROLE_BASE[role]`.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }

  // A bare role base has no index page — forward it to the FEES dashboard
  // (the portal's home; the expense dashboard is hidden from the sidebar).
  for (const base of Object.values(ROLE_BASE)) {
    if (pathname === base) {
      return NextResponse.redirect(new URL(`${base}/charges`, request.url));
    }
  }

  // Placeholder for the future session check:
  // const session = request.cookies.get("session");
  // if (!session && pathname !== ROUTES.login) {
  //   return NextResponse.redirect(new URL(ROUTES.login, request.url));
  // }

  return NextResponse.next();
}

export const config = {
  // Run on app routes only; skip assets, API, and Next internals.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
