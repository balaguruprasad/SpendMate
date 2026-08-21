import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd')

/** One statement line the admin imports. Amounts arrive in PAISE (integer). */
export const importRowSchema = z.object({
  cardNumber: z.string().trim().min(2).max(30),
  effectiveDate: isoDate,
  postingDate: isoDate.or(z.literal('')).default(''),
  amountPaise: z.number().int(),
  description: z.string().trim().min(1).max(500),
})

export const importTransactionsBody = z.object({
  rows: z.array(importRowSchema).min(1).max(2000),
})
export type ImportTransactionsInput = z.infer<typeof importTransactionsBody>

/** Member/helper edit of the app-owned fields on a charge. */
export const updateTransactionBody = z.object({
  category: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(2000).optional(),
  /** Comma-joined values of the configurable Tag dropdown. */
  tags: z.string().trim().max(500).optional(),
})
export type UpdateTransactionInput = z.infer<typeof updateTransactionBody>

/** Link an uploaded file (via /attachments) as the charge's invoice. */
export const attachInvoiceBody = z.object({
  gcsKey: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  sizeBytes: z.number().int().positive(),
})
export type AttachInvoiceInput = z.infer<typeof attachInvoiceBody>

export const createCardBody = z.object({
  holderId: z.uuid(),
  number: z
    .string()
    .trim()
    .regex(/^[\d ]{2,23}$/, 'Digits only (full number or last 4)'),
  label: z.string().trim().max(80).default(''),
  remindersOn: z.boolean().default(true),
})
export type CreateCardInput = z.infer<typeof createCardBody>

export const updateCardBody = z.object({
  holderId: z.uuid().optional(),
  number: z
    .string()
    .trim()
    .regex(/^[\d ]{2,23}$/, 'Digits only (full number or last 4)')
    .optional(),
  label: z.string().trim().max(80).optional(),
  remindersOn: z.boolean().optional(),
})
export type UpdateCardInput = z.infer<typeof updateCardBody>

export const addHelperBody = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export const settingsBody = z.object({
  categories: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
  tagLabel: z.string().trim().min(1).max(60),
  tagOptions: z.array(z.string().trim().min(1).max(120)).max(50),
})
export type SettingsInput = z.infer<typeof settingsBody>

export const reviewBulkBody = z.object({
  ids: z.array(z.uuid()).min(1).max(2000),
  on: z.boolean(),
})

const isoMonth = z.string().regex(/^\d{4}-\d{2}$/, 'Use yyyy-mm')

export const exportQuery = z.object({
  from: isoMonth.optional(),
  to: isoMonth.optional(),
  /** "1" → bundle the invoice files into the ZIP as well. */
  invoices: z.enum(['0', '1']).default('0'),
})

export const sendRemindersBody = z.object({
  /** Restrict to these cardholder user ids; empty/omitted = everyone pending. */
  userIds: z.array(z.uuid()).max(200).default([]),
})
