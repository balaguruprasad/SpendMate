import { Router } from 'express'
import * as controller from './attachment.controller.js'
import { requireAuth } from '../../core/auth/rbac.js'

const r = Router()
r.use(requireAuth)

r.get('/config', controller.config)
// Multer (multipart) only on the proxy upload route.
r.post('/upload', controller.uploadMiddleware, controller.proxyUpload)
r.post('/sign', controller.sign)
r.post('/', controller.register)
r.get('/', controller.list)
r.get('/:id/download', controller.download)
r.delete('/:id', controller.remove)

export const attachmentRouter = r
