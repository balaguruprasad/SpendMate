import { Router } from 'express'
import * as controller from './audit.controller.js'
import { requireAuth, requireRole } from '../../core/auth/rbac.js'

const r = Router()
r.use(requireAuth)
r.get('/', requireRole('ADMIN'), controller.list)

export const auditRouter = r
