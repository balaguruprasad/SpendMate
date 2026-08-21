import { randomUUID } from "node:crypto";
import express from "express";
import type { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { config } from "../config/index.js";
import { logger } from "../logging/index.js";
import { pingDb } from "../db/index.js";
import { landing, health } from "./landing.js";
import { mountDocs } from "../docs/index.js";
import { basicAuth, docsAuthConfigured } from "../admin/basic-auth.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { authRouter } from "../../modules/auth/auth.routes.js";
import { userRouter } from "../../modules/user/user.routes.js";
import { adminRouter } from "../../modules/admin/admin.routes.js";
import { attachmentRouter } from "../../modules/attachment/attachment.routes.js";
import { auditRouter } from "../../modules/audit/audit.routes.js";
import { notificationRouter } from "../../modules/notification/notification.routes.js";
import { spendRouter } from "../../modules/spend/spend.routes.js";
// Side-effect imports: register each module's OpenAPI paths before the doc is built.
import "../../modules/auth/auth.docs.js";
import "../../modules/user/user.docs.js";
import "../../modules/admin/admin.docs.js";
import "../../modules/attachment/attachment.docs.js";
import "../../modules/audit/audit.docs.js";
import "../../modules/notification/notification.docs.js";

export function buildApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger,
      genReqId: () => randomUUID(),
      // Don't log noisy health/asset pings.
      autoLogging: { ignore: (req) => req.url === "/healthz" || req.url === "/favicon.ico" },
      // Keep the request line clean even on errors — the central error handler logs the stack.
      serializers: { err: () => undefined },
      // One concise line per request; level reflects the status code.
      customLogLevel: (_req, res, err) =>
        res.statusCode >= 500 || err ? "error" : res.statusCode >= 400 ? "warn" : "info",
      customSuccessMessage: (req, res, responseTime) =>
        `${req.method} ${req.url} ${res.statusCode} ${responseTime}ms`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} ${res.statusCode} ${err.message}`,
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Quiet the browser's automatic favicon request (otherwise a 404 per page load).
  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  // Liveness + readiness
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/readyz", async (_req, res) => {
    const start = Date.now();
    try {
      await pingDb();
      res.json({
        status: "ready",
        checks: { database: { status: "up", latencyMs: Date.now() - start } },
      });
    } catch (err) {
      // Public endpoint — log the cause server-side, but don't leak DB error details in the body.
      logger.error({ err }, "readiness check failed: database unreachable");
      res.status(503).json({
        status: "not-ready",
        checks: { database: { status: "down" } },
      });
    }
  });

  // Public status landing (generic — no sensitive operational details).
  app.get("/", landing);

  // Authenticated status dashboard — same basic-auth creds as the docs (DOCS_USERNAME/PASSWORD).
  // Keeps DB status, latency, env and the service list off the public landing page.
  app.get("/health", basicAuth("Mesa System Health"), health);

  // API docs — ALWAYS gated. The spec/explorer reveal the whole API surface, so they must never
  // be public. With DOCS_USERNAME/PASSWORD set → HTTP Basic; without → disabled (404), never open.
  if (!docsAuthConfigured()) {
    logger.warn(
      "DOCS_USERNAME/DOCS_PASSWORD are not set — /docs, /redoc and /openapi.json are DISABLED (404). Set both to enable them behind basic auth.",
    );
  }
  app.use(["/docs", "/redoc", "/openapi.json"], basicAuth("Mesa API Docs"));
  mountDocs(app);

  // Rate limiting — scoped to the API only. Docs, the DB dashboard, the landing page, health
  // checks and static/asset requests (favicon, images) are intentionally NOT counted, so a
  // browser loading a page can't exhaust the API budget. Tunable via env.
  const apiLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Stricter limiter on login to blunt credential brute-forcing.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: config.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/v1", apiLimiter);
  app.use("/api/v1/auth/login", loginLimiter);

  // Feature routers
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/attachments", attachmentRouter);
  app.use("/api/v1/audit", auditRouter);
  app.use("/api/v1/notifications", notificationRouter);
  app.use("/api/v1/spend", spendRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
