import type { RequestHandler } from 'express'
import { listAuditQuery } from './audit.schema.js'
import * as service from './audit.service.js'
import { paginated } from '../../core/http/response.js'

export const list: RequestHandler = async (req, res) => {
  const query = listAuditQuery.parse(req.query)
  const { items, nextCursor } = await service.listAudit(query)
  paginated(res, items, { nextCursor })
}
