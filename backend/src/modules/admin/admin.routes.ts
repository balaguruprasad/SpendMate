import { Router } from 'express'
import * as controller from './admin.controller.js'
import { requireAuth, requireRole } from '../../core/auth/rbac.js'

const r = Router()
r.use(requireAuth)
r.use(requireRole('ADMIN'))

r.post('/impersonate', controller.impersonate)

export const adminRouter = r
