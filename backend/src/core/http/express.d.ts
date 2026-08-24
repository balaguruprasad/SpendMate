import type { Claims } from '../auth/jwt.js'

declare global {
  namespace Express {
    interface Request {
      user?: Claims
    }
  }
}

export {}
