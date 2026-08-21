import { Router } from 'express'
import * as controller from './notification.controller.js'
import { requireAuth } from '../../core/auth/rbac.js'

const r = Router()
r.use(requireAuth)

r.get('/', controller.listMine)
r.post('/read-all', controller.markAllRead)
r.patch('/:id/read', controller.markRead)

export const notificationRouter = r
