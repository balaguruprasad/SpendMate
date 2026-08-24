import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../../errors/index.js";
import { NotFoundError } from "../../errors/index.js";
import { logger } from "../../logging/index.js";

export const notFound: RequestHandler = (_req, _res, next) =>
  next(new NotFoundError("Route not found"));

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof z.ZodError) {
    res
      .status(422)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: z.flattenError(err),
        },
      });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }
  const reqId = (req as { id?: string }).id;
  logger.error({ err, reqId }, "unhandled error");
  res
    .status(500)
    .json({ error: { code: "INTERNAL", message: "Internal server error" } });
};
