import type { RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors/index.js";
import { verifyAccess } from "./jwt.js";
import type { Role } from "../db/types.js";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(new UnauthorizedError());
  try {
    req.user = await verifyAccess(token);
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return next(new ForbiddenError());
    next();
  };
