import type { RequestHandler } from 'express'
import { created, noContent, ok } from '../../core/http/response.js'
import * as service from './spend.service.js'
import { readStream } from '../../core/storage/gcs.js'
import {
  addHelperBody,
  attachInvoiceBody,
  createCardBody,
  exportQuery,
  importTransactionsBody,
  reviewBulkBody,
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

export const setReviewed: RequestHandler<IdParam> = async (req, res) => {
  const on = (req.body as { on?: boolean } | undefined)?.on !== false
  ok(res, await service.setReviewed(req.params.id, on, req.user!))
}

export const setReviewedBulk: RequestHandler = async (req, res) => {
  const { ids, on } = reviewBulkBody.parse(req.body)
  ok(res, await service.setReviewedBulk(ids, on, req.user!))
}

/** Reports download: CSV of every field, optionally zipped together with the
 * invoice files. Streams a ZIP (or bare CSV) — not the JSON envelope. */
export const exportReport: RequestHandler = async (req, res) => {
  const { from, to, invoices } = exportQuery.parse(req.query)
  const rows = await service.exportRows(from, to)

  const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)
  const stamp = [from ?? 'start', to ?? 'latest'].join('_to_')
  const header = [
    'Effective date', 'Posting date', 'Card', 'Cardholder', 'Description',
    'Amount (Rs)', 'Category', 'Department', 'Status', 'Pending', 'Remarks',
    'Reviewed (accounting done)', 'Reviewed by', 'Invoice file', 'Invoice in bundle',
  ]
  const invoiceEntry = (r: service.ExportRow): string => {
    if (!r.invoiceKey) return ''
    const ext = (r.invoiceName.split('.').pop() ?? 'pdf').toLowerCase()
    const holder = r.cardholder.replace(/[^a-zA-Z0-9]+/g, '-')
    return `invoices/${r.effectiveDate}_${holder}_${r.id.slice(0, 8)}.${ext}`
  }
  const csv = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.effectiveDate, r.postingDate ?? '', r.card, r.cardholder, r.description,
        (r.amountPaise / 100).toFixed(2), r.category, r.tags,
        r.settlement ? 'Settlement' : r.pending ? 'Pending' : r.status === 'SUBMITTED' ? 'Submitted' : 'No invoice needed',
        r.pending ? 'Yes' : 'No', r.remarks,
        r.reviewed ? 'Yes' : 'No', r.reviewedByName, r.invoiceName,
        invoices === '1' ? invoiceEntry(r) : '',
      ]
        .map((c) => esc(String(c)))
        .join(','),
    ),
  ].join('\r\n')

  if (invoices !== '1') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="spendmate-report-${stamp}.csv"`)
    res.send('﻿' + csv) // BOM so Excel opens it as UTF-8
    return
  }

  const { ZipArchive } = await import('archiver')
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="spendmate-report-${stamp}.zip"`)
  const zip = new ZipArchive({ zlib: { level: 6 } })
  zip.on('error', (err: Error) => res.destroy(err))
  zip.pipe(res)
  zip.append('﻿' + csv, { name: `spendmate-report-${stamp}.csv` })
  for (const r of rows) {
    if (!r.invoiceKey) continue
    zip.append(readStream(r.invoiceKey) as import('node:stream').Readable, { name: invoiceEntry(r) })
  }
  await zip.finalize()
}

export const weeklyReminders: RequestHandler = async (req, res) => {
  const on = Boolean((req.body as { on?: boolean } | undefined)?.on)
  ok(res, await service.setWeeklyReminders(on, req.user!))
}

export const presencePing: RequestHandler = async (req, res) => {
  ok(res, await service.presencePing(req.user!))
}

export const loginActivity: RequestHandler = async (_req, res) => {
  ok(res, await service.loginActivity())
}
