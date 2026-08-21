/**
 * Zod-validated public environment. Reference each NEXT_PUBLIC_* as a literal
 * so Next inlines it. Add new public vars here and to .env.example.
 *
 * While the Express/Postgres backend doesn't exist yet, the app runs against
 * the in-memory mock layer (NEXT_PUBLIC_USE_MOCK="true", the default).
 */
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().or(z.literal("")).default(""),
  NEXT_PUBLIC_USE_MOCK: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK,
});

if (!parsed.success) {
  const msg = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Invalid environment configuration:\n${msg}`);
  }
  // eslint-disable-next-line no-console
  console.warn(`⚠️  Invalid environment configuration:\n${msg}`);
}

export const env = parsed.success
  ? parsed.data
  : { NEXT_PUBLIC_API_BASE_URL: "", NEXT_PUBLIC_USE_MOCK: true };
