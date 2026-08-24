import { Router } from 'express'
import * as controller from './auth.controller.js'
import { requireAuth } from '../../core/auth/rbac.js'

const r = Router()
r.post('/login', controller.login)
r.post('/refresh', controller.refresh)
r.post('/logout', controller.logout)
r.get('/me', requireAuth, controller.me)
r.post('/change-password', requireAuth, controller.changePassword)

export const authRouter = r
