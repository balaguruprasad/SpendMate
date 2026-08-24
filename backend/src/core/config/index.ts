import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_SSL: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  // Optional: PEM contents of the database server's CA cert (e.g. Cloud SQL server-ca.pem).
  // Provide this to keep full TLS verification when connecting to a managed DB.
  DB_CA_CERT: z.string().optional(),
  // Escape hatch for connecting to a public-IP managed DB without its CA in the trust store.
  // INSECURE (skips cert verification → MITM risk). Dev only; prefer DB_CA_CERT in production.
  DB_SSL_NO_VERIFY: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  // Basic-auth creds for /docs, /redoc and /openapi.json. When BOTH are set those routes require
  // login; when unset they are DISABLED (404) — the API surface is never publicly exposed.
  DOCS_USERNAME: z.string().optional(),
  DOCS_PASSWORD: z.string().optional(),
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  // Rate limiting — applied to /api/* only (docs, dashboard, health, assets are exempt).
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(600),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  // --- Google Cloud Storage (file attachments) ---------------------------------
  // All optional so the app still boots without GCS configured; the storage helpers
  // lazy-init and throw a clear error only when an upload/download is actually attempted.
  GCS_BUCKET_NAME: z.string().optional(),
  GCS_BUCKET_PREFIX: z.string().default("mesa-finance"),
  GCS_SERVICE_ACCOUNT_PATH: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  // false (default) = proxy upload through the API (local); true = browser PUTs to a signed URL (prod).
  GCS_USE_SIGNED_URLS: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  // Signed URL lifetime in seconds. Default is a short 15 min; large explicit values are still
  // accepted (e.g. a long-lived asset bucket) but trigger a security WARN at boot (below).
  GCS_SIGNED_URL_EXPIRATION: z.coerce.number().int().positive().default(900),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ Invalid environment:",
    z.flattenError(parsed.error).fieldErrors,
  );
  process.exit(1);
}

export const config = Object.freeze(parsed.data);
export type Config = typeof config;

// Long-lived signed URLs are a standing security risk (a leaked URL stays valid for its full TTL).
// We still honour an explicit large value, but flag it loudly at boot. console.* (not the logger,
// which imports this module) to avoid a circular import.
if (config.GCS_SIGNED_URL_EXPIRATION > 3600) {
  // eslint-disable-next-line no-console
  console.warn(
    `⚠️  GCS_SIGNED_URL_EXPIRATION=${config.GCS_SIGNED_URL_EXPIRATION}s > 1h — long-lived signed URLs are a security risk`,
  );
}
