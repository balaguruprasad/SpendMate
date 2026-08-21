import type { RequestHandler } from 'express'
import * as service from './notification.service.js'
import { ok, paginated } from '../../core/http/response.js'

type IdParam = { id: string }

export const listMine: RequestHandler = async (req, res) => {
  const { items, unreadCount } = await service.listMine(req.user!.sub)
  paginated(res, items, { unreadCount })
}

export const markRead: RequestHandler<IdParam> = async (req, res) => {
  ok(res, await service.markRead(req.params.id, req.user!.sub))
}

export const markAllRead: RequestHandler = async (req, res) => {
  ok(res, await service.markAllRead(req.user!.sub))
}
