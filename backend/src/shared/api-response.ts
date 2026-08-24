export type PageMeta = { nextCursor?: string | null; total?: number; unreadCount?: number }

export type ApiSuccess<T> = { data: T; meta?: PageMeta }
export type ApiError = { error: { code: string; message: string; details?: unknown } }
export type ApiResponse<T> = ApiSuccess<T> | ApiError
