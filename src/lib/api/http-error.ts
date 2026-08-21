import type { ApiErrorBody } from "@/types";

/** Stable error type so callers/toasts get `.message`, `.status`, `.code`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    // The Express backend nests errors as `{ error: { code, message, details } }`.
    // Tolerate a flat shape too, for resilience.
    let body: { error?: Partial<ApiErrorBody> } & Partial<ApiErrorBody> = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      // non-JSON error body
    }
    const err = body.error ?? body;
    return new ApiError(
      withFieldDetail(err.message ?? res.statusText ?? "Request failed", err.details),
      res.status,
      err.code,
      err.details,
    );
  }
}

/**
 * A bare "Invalid input" helps nobody — when the zod details carry field
 * errors, surface the first one ("ifsc: Enter a valid IFSC (e.g. KKBK0008077)")
 * so the toast names the actual problem.
 */
function withFieldDetail(message: string, details: unknown): string {
  const fieldErrors = (details as { fieldErrors?: Record<string, string[]> } | null)?.fieldErrors;
  if (!fieldErrors) return message;
  const [field, errors] = Object.entries(fieldErrors).find(([, v]) => v?.length) ?? [];
  if (!field || !errors?.length) return message;
  return `${message} — ${field}: ${errors[0]}`;
}
