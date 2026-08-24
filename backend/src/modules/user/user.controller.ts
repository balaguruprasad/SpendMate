import type { RequestHandler } from 'express'
import { createUserBody, updateUserBody, listUsersQuery, resetPasswordBody } from './user.schema.js'
import * as service from './user.service.js'
import { ok, created } from '../../core/http/response.js'

type IdParam = { id: string }

export const list: RequestHandler = async (req, res) => {
  const query = listUsersQuery.parse(req.query)
  ok(res, await service.listUsers(query))
}

export const create: RequestHandler = async (req, res) => {
  const input = createUserBody.parse(req.body)
  created(res, await service.createUser(input, req.user!))
}

export const getOne: RequestHandler<IdParam> = async (req, res) => {
  ok(res, await service.getUser(req.params.id))
}

export const update: RequestHandler<IdParam> = async (req, res) => {
  const input = updateUserBody.parse(req.body)
  ok(res, await service.updateUser(req.params.id, input, req.user!))
}

export const remove: RequestHandler<IdParam> = async (req, res) => {
  ok(res, await service.deleteUser(req.params.id, req.user!))
}

export const resetPassword: RequestHandler<IdParam> = async (req, res) => {
  const { newPassword } = resetPasswordBody.parse(req.body)
  ok(res, await service.resetPassword(req.params.id, newPassword, req.user!))
}

export const exportUsers: RequestHandler = async (req, res) => {
  const csv = await service.exportUsersToCsv()
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="users.csv"')
  res.status(200).send(csv)
}

export const downloadTemplate: RequestHandler = async (req, res) => {
  const csv = await service.generateUserTemplateCsv()
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="users_template.csv"')
  res.status(200).send(csv)
}

export const bulkUpload: RequestHandler = async (req, res) => {
  const { csvText } = req.body
  if (typeof csvText !== 'string') {
    res.status(400).json({ error: 'csvText is required in JSON body.' })
    return
  }
  const result = await service.bulkUploadUsers(csvText, req.user!)
  ok(res, result)
}
