/**
 * SpendMate core — the G-Sheets v2 rules, verbatim:
 *
 *  - Admin imports statement rows (append-only). Each row is matched to a
 *    card by number (exact or last-4) → cardholder.
 *  - A charge is DONE when it has an invoice (SUBMITTED) or a category chosen
 *    with no invoice (NO_INVOICE_NEEDED) — AND, when the Tag dropdown is
 *    configured (e.g. Departments), at least one tag. Otherwise it is pending.
 *  - Cardholders (and their nominated HELPERS) upload invoices and fill in
 *    category/tag/remarks. Reminders go only to cardholders.
 *  - Auto-categorize: bank line items ("GST", "ISSUER MARKUP ASSESSMENT")
 *    get their category/tag filled on import and need no invoice.
 */
import { db } from '../../core/db/index.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '../../core/errors/index.js'
import { writeAudit } from '../../core/audit/index.js'
import { createNotification } from '../../core/notify/index.js'
import type { Claims } from '../../core/auth/jwt.js'
import type { Kysely, Transaction as Trx } from 'kysely'
import type { DB, TxnStatus } from '../../core/db/types.js'
import { insertAttachment } from '../attachment/attachment.repository.js'
import * as repo from './spend.repository.js'
import type {
  AttachInvoiceInput,
  CreateCardInput,
  ImportTransactionsInput,
  SettingsInput,
  UpdateCardInput,
  UpdateTransactionInput,
} from './spend.schema.js'

type Conn = Kysely<DB> | Trx<DB>

// ── Settings ────────────────────────────────────────────────────────────────

export interface SpendSettings {
  categories: string[]
  tagLabel: string
  tagOptions: string[]
}

const DEFAULT_SETTINGS: SpendSettings = {
  categories: ['Transaction charges', 'GST', 'Markup Charges', 'Others'],
  tagLabel: 'Department',
  tagOptions: [],
}

export async function getSettings(conn: Conn = db): Promise<SpendSettings> {
  const row = await conn
    .selectFrom('app_settings')
    .select('value')
    .where('key', '=', 'spend')
    .executeTakeFirst()
  if (!row) return DEFAULT_SETTINGS
  const v = row.value as Partial<SpendSettings>
  return {
    categories: v.categories?.length ? v.categories : DEFAULT_SETTINGS.categories,
    tagLabel: v.tagLabel || DEFAULT_SETTINGS.tagLabel,
    tagOptions: v.tagOptions ?? [],
  }
}

export async function saveSettings(input: SettingsInput, user: Claims): Promise<SpendSettings> {
  await db
    .insertInto('app_settings')
    .values({ key: 'spend', value: JSON.stringify(input), updatedAt: new Date() })
    .onConflict((oc) =>
      oc.column('key').doUpdateSet({ value: JSON.stringify(input), updatedAt: new Date() }),
    )
    .execute()
  await db.transaction().execute((trx) =>
    writeAudit(trx, {
      entityType: 'SPEND_SETTINGS',
      entityId: user.sub,
      action: 'UPDATED',
      actorId: user.sub,
      metadata: input,
    }),
  )
  return getSettings()
}

// ── Card matching ───────────────────────────────────────────────────────────

const digits = (s: string): string => s.replace(/\D/g, '')

/** Match a raw statement card number to a card row (exact or last-4). */
function matchCard(cardNumber: string, cards: { id: string; number: string }[]): string | null {
  const c = digits(cardNumber)
  if (!c) return null
  for (const card of cards) {
    const h = digits(card.number)
    if (!h) continue
    if (c === h || (c.length >= 4 && h.length >= 4 && c.slice(-4) === h.slice(-4))) {
      return card.id
    }
  }
  return null
}

/** Re-match every transaction to the current cards (after card changes). */
export async function relinkTransactions(conn: Conn = db): Promise<number> {
  const cards = await conn.selectFrom('cards').select(['id', 'number']).execute()
  const txns = await conn.selectFrom('transactions').select(['id', 'cardNumber', 'cardId']).execute()
  let changed = 0
  for (const t of txns) {
    const next = matchCard(t.cardNumber, cards)
    if (next !== t.cardId) {
      await conn.updateTable('transactions').set({ cardId: next }).where('id', '=', t.id).execute()
      changed++
    }
  }
  return changed
}

// ── Auto-categorize (bank line items) ───────────────────────────────────────

const AUTO_CAT_RULES: Record<string, { cat: string; tag: string }> = {
  gst: { cat: 'GST', tag: 'Others' },
  'issuer markup assessment': { cat: 'Markup Charges', tag: 'Others' },
}

function autoRule(description: string): { cat: string; tag: string } | null {
  return AUTO_CAT_RULES[description.trim().toLowerCase()] ?? null
}

// ── Pending rule ────────────────────────────────────────────────────────────

export function isRowPending(
  row: { status: TxnStatus; tags: string },
  tagRequired: boolean,
): boolean {
  if (row.status === 'PENDING') return true
  if (tagRequired && !row.tags.trim()) return true
  return false
}

// ── Identity / context ──────────────────────────────────────────────────────

export async function getMyContext(user: Claims) {
  const [cards, helping, myHelpers, settings] = await Promise.all([
    repo.listCards(),
    repo.listHelpingFor(user.sub),
    repo.listHelpersOf(user.sub),
    getSettings(),
  ])
  const myCards = cards.filter((c) => c.holderId === user.sub)
  return {
    isAdmin: user.role === 'ADMIN',
    myCards: myCards.map((c) => ({ id: c.id, number: maskCard(c.number), label: c.label, remindersOn: c.remindersOn })),
    helperFor: helping.map((h) => ({ id: h.holderId, name: h.holderName })),
    myHelpers: myHelpers.map((h) => ({ id: h.helperId, name: h.helperName, email: h.helperEmail })),
    settings,
  }
}

function maskCard(number: string): string {
  const d = digits(number)
  return d.length > 4 ? `•••• ${d.slice(-4)}` : d
}

// ── Transactions ────────────────────────────────────────────────────────────

export interface TransactionPublic {
  id: string
  card: string
  cardholder: string
  cardholderId: string | null
  effectiveDate: string
  postingDate: string | null
  amountPaise: number
  description: string
  category: string
  status: TxnStatus
  remarks: string
  invoiceName: string
  invoiceUrl: string
  tags: string
  pending: boolean
  updatedAt: string
}

const iso = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null)

function toPublic(r: repo.TransactionListRow, tagRequired: boolean): TransactionPublic {
  return {
    id: r.id,
    card: maskCard(r.cardNumber),
    cardholder: r.holderName ?? 'Unassigned',
    cardholderId: r.holderId,
    effectiveDate: iso(r.effectiveDate)!,
    postingDate: iso(r.postingDate),
    amountPaise: r.amountPaise,
    description: r.description,
    category: r.category,
    status: r.status,
    remarks: r.remarks,
    invoiceName: r.invoiceName,
    invoiceUrl: r.invoiceUrl,
    tags: r.tags,
    pending: isRowPending(r, tagRequired),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export async function listTransactions(user: Claims) {
  const [rows, settings] = await Promise.all([repo.listTransactions(), getSettings()])
  const tagRequired = settings.tagOptions.length > 0

  if (user.role === 'ADMIN') {
    const all = rows.map((r) => toPublic(r, tagRequired))
    return { rows: all, summary: buildSummary(all) }
  }

  const helping = await repo.listHelpingFor(user.sub)
  const visible = new Set<string>([user.sub, ...helping.map((h) => h.holderId)])
  const mine = rows.filter((r) => r.holderId && visible.has(r.holderId)).map((r) => toPublic(r, tagRequired))
  return { rows: mine, summary: buildSummary(mine) }
}

function buildSummary(rows: TransactionPublic[]) {
  const byPerson: Record<string, { total: number; count: number; pending: number }> = {}
  for (const r of rows) {
    const key = r.cardholder
    byPerson[key] = byPerson[key] ?? { total: 0, count: 0, pending: 0 }
    byPerson[key].total += r.amountPaise
    byPerson[key].count += 1
    if (r.pending) byPerson[key].pending += 1
  }
  return byPerson
}

async function assertRowAccess(txnId: string, user: Claims, conn: Conn): Promise<void> {
  if (user.role === 'ADMIN') return
  const holderId = await repo.transactionHolderId(txnId, conn)
  if (!holderId) throw new ForbiddenError('This charge is not assigned to a cardholder yet.')
  if (holderId === user.sub) return
  if (await repo.isHelperOf(holderId, user.sub, conn)) return
  throw new ForbiddenError('You do not have permission to edit this charge.')
}

/** Category / remarks / tags edit — with the Apps Script status rules. */
export async function updateTransaction(
  txnId: string,
  input: UpdateTransactionInput,
  user: Claims,
) {
  return db.transaction().execute(async (trx) => {
    const txn = await repo.findTransaction(txnId, trx)
    if (!txn) throw new NotFoundError('Transaction not found')
    await assertRowAccess(txnId, user, trx)
    const settings = await getSettings(trx)

    const patch: Record<string, unknown> = {}
    if (input.remarks !== undefined) patch.remarks = input.remarks

    if (input.category !== undefined) {
      if (input.category && !settings.categories.includes(input.category)) {
        throw new UnprocessableError('UNKNOWN_CATEGORY', `Unknown category: ${input.category}`)
      }
      patch.category = input.category
      // Invoice present → stays SUBMITTED; else category chosen → no invoice
      // needed; category cleared → back to Pending.
      patch.status = txn.invoiceKey
        ? 'SUBMITTED'
        : input.category
          ? 'NO_INVOICE_NEEDED'
          : 'PENDING'
    }

    if (input.tags !== undefined) {
      const parts = input.tags.split(',').map((s) => s.trim()).filter(Boolean)
      for (const p of parts) {
        if (!settings.tagOptions.includes(p)) {
          throw new UnprocessableError('UNKNOWN_TAG', `Unknown ${settings.tagLabel}: ${p}`)
        }
      }
      patch.tags = parts.join(', ')
    }

    await trx.updateTable('transactions').set(patch).where('id', '=', txnId).execute()
    await writeAudit(trx, {
      entityType: 'SPEND_TXN',
      entityId: txnId,
      action: 'UPDATED',
      actorId: user.sub,
      metadata: { ...patch },
    })
    const updated = await repo.findTransaction(txnId, trx)
    return updated
  })
}

/** Link an uploaded file as the charge's invoice → SUBMITTED. */
export async function attachInvoice(txnId: string, input: AttachInvoiceInput, user: Claims) {
  return db.transaction().execute(async (trx) => {
    const txn = await repo.findTransaction(txnId, trx)
    if (!txn) throw new NotFoundError('Transaction not found')
    await assertRowAccess(txnId, user, trx)

    const att = await insertAttachment(
      {
        entityType: 'TRANSACTION',
        entityId: txnId,
        storageKey: input.gcsKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedBy: user.sub,
      },
      trx,
    )
    await trx
      .updateTable('transactions')
      .set({
        status: 'SUBMITTED',
        invoiceName: input.fileName,
        invoiceKey: input.gcsKey,
        invoiceUrl: `/api/v1/attachments/${att.id}/download`,
      })
      .where('id', '=', txnId)
      .execute()
    await writeAudit(trx, {
      entityType: 'SPEND_TXN',
      entityId: txnId,
      action: 'INVOICE_UPLOADED',
      actorId: user.sub,
      metadata: { fileName: input.fileName, sizeBytes: input.sizeBytes },
    })
    return repo.findTransaction(txnId, trx)
  })
}

/** Admin paste/CSV import — append-only, auto-matched, auto-categorized. */
export async function importTransactions(input: ImportTransactionsInput, user: Claims) {
  return db.transaction().execute(async (trx) => {
    const cards = await trx.selectFrom('cards').select(['id', 'number']).execute()
    let imported = 0
    let autoCategorized = 0
    for (const row of input.rows) {
      const rule = autoRule(row.description)
      const cardId = matchCard(row.cardNumber, cards)
      await trx
        .insertInto('transactions')
        .values({
          cardNumber: row.cardNumber.trim(),
          cardId,
          effectiveDate: new Date(row.effectiveDate),
          postingDate: row.postingDate ? new Date(row.postingDate) : null,
          amountPaise: row.amountPaise,
          description: row.description,
          category: rule?.cat ?? '',
          status: rule ? 'NO_INVOICE_NEEDED' : 'PENDING',
          tags: rule?.tag ?? '',
          updatedAt: new Date(),
        })
        .execute()
      imported++
      if (rule) autoCategorized++
    }
    await writeAudit(trx, {
      entityType: 'SPEND_IMPORT',
      entityId: user.sub,
      action: 'IMPORTED',
      actorId: user.sub,
      metadata: { imported, autoCategorized },
    })
    return { imported, autoCategorized }
  })
}

// ── Cards (admin) ───────────────────────────────────────────────────────────

export async function listCards() {
  const cards = await repo.listCards()
  return cards.map((c) => ({ ...c, number: c.number.trim() }))
}

export async function createCard(input: CreateCardInput, user: Claims) {
  return db.transaction().execute(async (trx) => {
    const holder = await trx
      .selectFrom('users')
      .select(['id', 'name'])
      .where('id', '=', input.holderId)
      .executeTakeFirst()
    if (!holder) throw new NotFoundError('Cardholder user not found')
    const card = await trx
      .insertInto('cards')
      .values({
        holderId: input.holderId,
        number: digits(input.number),
        label: input.label,
        remindersOn: input.remindersOn,
        updatedAt: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    await writeAudit(trx, {
      entityType: 'SPEND_CARD',
      entityId: card.id,
      action: 'CREATED',
      actorId: user.sub,
      metadata: { holder: holder.name, last4: digits(input.number).slice(-4) },
    })
    await relinkTransactions(trx)
    return card
  })
}

export async function updateCard(id: string, input: UpdateCardInput, user: Claims) {
  return db.transaction().execute(async (trx) => {
    const card = await repo.findCard(id, trx)
    if (!card) throw new NotFoundError('Card not found')
    const patch: Record<string, unknown> = {}
    if (input.holderId !== undefined) patch.holderId = input.holderId
    if (input.number !== undefined) patch.number = digits(input.number)
    if (input.label !== undefined) patch.label = input.label
    if (input.remindersOn !== undefined) patch.remindersOn = input.remindersOn
    await trx.updateTable('cards').set(patch).where('id', '=', id).execute()
    await writeAudit(trx, {
      entityType: 'SPEND_CARD',
      entityId: id,
      action: 'UPDATED',
      actorId: user.sub,
      metadata: patch,
    })
    await relinkTransactions(trx)
    return repo.findCard(id, trx)
  })
}

export async function deleteCard(id: string, user: Claims) {
  return db.transaction().execute(async (trx) => {
    const card = await repo.findCard(id, trx)
    if (!card) throw new NotFoundError('Card not found')
    await trx.deleteFrom('cards').where('id', '=', id).execute()
    await writeAudit(trx, {
      entityType: 'SPEND_CARD',
      entityId: id,
      action: 'DELETED',
      actorId: user.sub,
      metadata: { last4: digits(card.number).slice(-4) },
    })
    await relinkTransactions(trx)
  })
}

// ── Helpers (cardholder-managed) ────────────────────────────────────────────

const MAX_HELPERS = 10

export async function addHelper(email: string, user: Claims) {
  return db.transaction().execute(async (trx) => {
    const helper = await trx
      .selectFrom('users')
      .select(['id', 'name', 'email', 'isActive'])
      .where('email', '=', email)
      .executeTakeFirst()
    if (!helper || !helper.isActive) {
      throw new NotFoundError(
        `${email} is not a SpendMate user yet — ask the admin to add them first.`,
      )
    }
    if (helper.id === user.sub) {
      throw new ConflictError('SELF_HELPER', 'That is your own account — you can already do everything here.')
    }
    const existing = await repo.listHelpersOf(user.sub, trx)
    if (existing.some((h) => h.helperId === helper.id)) {
      throw new ConflictError('ALREADY_HELPER', `${helper.name} is already one of your helpers.`)
    }
    if (existing.length >= MAX_HELPERS) {
      throw new ConflictError('TOO_MANY_HELPERS', `You can have at most ${MAX_HELPERS} helpers.`)
    }
    await trx.insertInto('card_helpers').values({ holderId: user.sub, helperId: helper.id }).execute()
    const helperRole = await trx.selectFrom('users').select('role').where('id','=',helper.id).executeTakeFirst()
    await writeAudit(trx, {
      entityType: 'SPEND_HELPER',
      entityId: user.sub,
      action: 'ADDED',
      actorId: user.sub,
      metadata: { helper: helper.email },
    })
    await createNotification(trx, {
      userId: helper.id,
      type: 'SPEND_HELPER_ADDED',
      title: 'You can now help with credit-card invoices',
      body: 'A cardholder added you as their invoice helper — their charges now show in SpendMate.',
      linkPath: helperRole?.role === 'ADMIN' ? '/admin/charges' : '/member/charges',
    })
    return repo.listHelpersOf(user.sub, trx)
  })
}

export async function removeHelper(helperId: string, user: Claims) {
  return db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('card_helpers')
      .where('holderId', '=', user.sub)
      .where('helperId', '=', helperId)
      .execute()
    await writeAudit(trx, {
      entityType: 'SPEND_HELPER',
      entityId: user.sub,
      action: 'REMOVED',
      actorId: user.sub,
      metadata: { helperId },
    })
    return repo.listHelpersOf(user.sub, trx)
  })
}

// ── Reminders ───────────────────────────────────────────────────────────────
// In-app notifications always; email on top when SMTP is configured (prod).

export async function sendReminders(userIds: string[], user: Claims) {
  const [rows, settings, cards] = await Promise.all([
    repo.listTransactions(),
    getSettings(),
    repo.listCards(),
  ])
  const tagRequired = settings.tagOptions.length > 0

  const remindable = new Map<string, { name: string; count: number; totalPaise: number }>()
  for (const r of rows) {
    if (!r.holderId || !isRowPending(r, tagRequired)) continue
    if (userIds.length && !userIds.includes(r.holderId)) continue
    const holderCards = cards.filter((c) => c.holderId === r.holderId)
    if (holderCards.length && holderCards.every((c) => !c.remindersOn)) continue
    const e = remindable.get(r.holderId) ?? { name: r.holderName ?? '', count: 0, totalPaise: 0 }
    e.count += 1
    e.totalPaise += r.amountPaise
    remindable.set(r.holderId, e)
  }

  const sent: string[] = []
  await db.transaction().execute(async (trx) => {
    for (const [holderId, info] of remindable) {
      await createNotification(trx, {
        userId: holderId,
        type: 'SPEND_REMINDER',
        title: `${info.count} charge${info.count === 1 ? '' : 's'} pending on your company card`,
        body: `₹${(info.totalPaise / 100).toLocaleString('en-IN')} needs invoices / details — open SpendMate to complete them.`,
        linkPath: '/charges',
      })
      sent.push(info.name)
    }
    const stamp = new Date().toISOString()
    await trx
      .insertInto('app_settings')
      .values({
        key: 'spend.lastReminder',
        value: JSON.stringify({ at: stamp, sent: sent.length, by: user.sub }),
        updatedAt: new Date(),
      })
      .onConflict((oc) =>
        oc.column('key').doUpdateSet({
          value: JSON.stringify({ at: stamp, sent: sent.length, by: user.sub }),
          updatedAt: new Date(),
        }),
      )
      .execute()
    await writeAudit(trx, {
      entityType: 'SPEND_REMINDER',
      entityId: user.sub,
      action: 'SENT',
      actorId: user.sub,
      metadata: { recipients: sent },
    })
  })
  return { sent }
}

export async function reminderInfo() {
  const row = await db
    .selectFrom('app_settings')
    .select('value')
    .where('key', '=', 'spend.lastReminder')
    .executeTakeFirst()
  return { lastRun: row ? (row.value as { at: string; sent: number }) : null }
}
