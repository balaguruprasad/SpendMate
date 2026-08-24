export abstract class AppError extends Error {
  abstract readonly status: number
  abstract readonly code: string
  readonly details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = this.constructor.name
    this.details = details
  }
}

export class ValidationError extends AppError {
  readonly status = 422
  readonly code = 'VALIDATION_ERROR'
}

export class BadRequestError extends AppError {
  readonly status = 400
  readonly code: string
  constructor(code: string, message: string, details?: unknown) {
    super(message, details)
    this.code = code
  }
}

export class UnauthorizedError extends AppError {
  readonly status = 401
  readonly code: string
  constructor(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    super(message)
    this.code = code
  }
}

export class ForbiddenError extends AppError {
  readonly status = 403
  readonly code = 'FORBIDDEN'
  constructor(message = 'You do not have access to this resource') {
    super(message)
  }
}

export class NotFoundError extends AppError {
  readonly status = 404
  readonly code = 'NOT_FOUND'
  constructor(message = 'Resource not found') {
    super(message)
  }
}

export class ConflictError extends AppError {
  readonly status = 409
  readonly code: string
  constructor(code: string, message: string, details?: unknown) {
    super(message, details)
    this.code = code
  }
}

/** 422 with a domain-specific code (semantically-invalid input, distinct from the schema VALIDATION_ERROR). */
export class UnprocessableError extends AppError {
  readonly status = 422
  readonly code: string
  constructor(code: string, message: string, details?: unknown) {
    super(message, details)
    this.code = code
  }
}
