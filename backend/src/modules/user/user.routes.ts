import { Router } from 'express'
import * as controller from './user.controller.js'
import { requireAuth, requireRole } from '../../core/auth/rbac.js'

const r = Router()
r.use(requireAuth)
r.use(requireRole('ADMIN'))

r.get('/', controller.list)
r.post('/', controller.create)
r.get('/export/csv', controller.exportUsers)
r.get('/export/template', controller.downloadTemplate)
r.post('/bulk-upload', controller.bulkUpload)
r.get('/:id', controller.getOne)
r.patch('/:id', controller.update)
r.patch('/:id/password', controller.resetPassword)
r.delete('/:id', controller.remove)

export const userRouter = r
