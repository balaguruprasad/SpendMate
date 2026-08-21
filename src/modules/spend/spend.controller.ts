import type { RequestHandler } from 'express'
import { created, noContent, ok } from '../../core/http/response.js'
import * as service from './spend.service.js'
import {
  addHelperBody,
  attachInvoiceBody,
  createCardBody,
  importTransactionsBody,
  sendRemindersBody,
  settingsBody,
  updateCardBody,
  updateTransactionBody,
} from './spend.schema.js'

type IdParam = { id: string }

export const getMe: RequestHandler = async (req, res) => {
  ok(res, await service.getMyContext(req.user!))
}

export const getSettings: RequestHandler = async (_req, res) => {
  ok(res, await service.getSettings())
}

export const saveSettings: RequestHandler = async (req, res) => {
  ok(res, await service.saveSettings(settingsBody.parse(req.body), req.user!))
}

export const listTransactions: RequestHandler = async (req, res) => {
  ok(res, await service.listTransactions(req.user!))
}

export const updateTransaction: RequestHandler<IdParam> = async (req, res) => {
  ok(res, await service.updateTransaction(req.params.id, updateTransactionBody.parse(req.body), req.user!))
}

export const attachInvoice: RequestHandler<IdParam> = async (req, res) => {
  ok(res, await service.attachInvoice(req.params.id, attachInvoiceBody.parse(req.body), req.user!))
}

export const importTransactions: RequestHandler = async (req, res) => {
  ok(res, await service.importTransactions(importTransactionsBody.parse(req.body), req.user!))
}

export const listCards: RequestHandler = async (_req, res) => {
  ok(res, await service.listCards())
}

export const createCard: RequestHandler = async (req, res) => {
  created(res, await service.createCard(createCardBody.parse(req.body), req.user!))
}

export const updateCard: RequestHandler<IdParam> = async (req, res) => {
  ok(res, await service.updateCard(req.params.id, updateCardBody.parse(req.body), req.user!))
}

export const deleteCard: RequestHandler<IdParam> = async (req, res) => {
  await service.deleteCard(req.params.id, req.user!)
  noContent(res)
}

export const addHelper: RequestHandler = async (req, res) => {
  const { email } = addHelperBody.parse(req.body)
  ok(res, await service.addHelper(email, req.user!))
}

export const removeHelper: RequestHandler<IdParam> = async (req, res) => {
  ok(res, await service.removeHelper(req.params.id, req.user!))
}

export const sendReminders: RequestHandler = async (req, res) => {
  const { userIds } = sendRemindersBody.parse(req.body ?? {})
  ok(res, await service.sendReminders(userIds, req.user!))
}

export const reminderInfo: RequestHandler = async (_req, res) => {
  ok(res, await service.reminderInfo())
}

export const presencePing: RequestHandler = async (req, res) => {
  ok(res, await service.presencePing(req.user!))
}

export const loginActivity: RequestHandler = async (_req, res) => {
  ok(res, await service.loginActivity())
}
