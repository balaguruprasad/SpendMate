import { SignJWT, jwtVerify } from "jose";
import { config } from "../config/index.js";
import type { Role } from "../db/types.js";

const accessSecret = new TextEncoder().encode(config.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(config.JWT_REFRESH_SECRET);

export type Claims = {
  sub: string;
  role: Role;
  departmentId: string | null;
  /** Set only during admin impersonation: the impersonating admin's user id. */
  imp?: string;
};

export function signAccess(c: Claims): Promise<string> {
  const payload: Record<string, unknown> = { role: c.role, departmentId: c.departmentId };
  if (c.imp) payload.imp = c.imp;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.sub)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessSecret);
}

export function signRefresh(sub: string, tokenId: string): Promise<string> {
  return new SignJWT({ tid: tokenId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(refreshSecret);
}

export async function verifyAccess(token: string): Promise<Claims> {
  const { payload } = await jwtVerify(token, accessSecret);
  return {
    sub: String(payload.sub),
    role: payload.role as Role,
    departmentId: (payload.departmentId as string | null) ?? null,
    ...(payload.imp ? { imp: String(payload.imp) } : {}),
  };
}

export async function verifyRefresh(
  token: string,
): Promise<{ sub: string; tid: string }> {
  const { payload } = await jwtVerify(token, refreshSecret);
  return { sub: String(payload.sub), tid: String(payload.tid) };
}
