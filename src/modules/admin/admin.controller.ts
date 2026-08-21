import type { RequestHandler } from 'express'
import { impersonateBody } from './admin.schema.js'
import * as adminService from './admin.service.js'
import { ok } from '../../core/http/response.js'

export const impersonate: RequestHandler = async (req, res) => {
  const { userId } = impersonateBody.parse(req.body)
  ok(res, await adminService.impersonate(userId, req.user!))
}
