import type { Kysely, Transaction as Trx } from 'kysely'
import { sql } from 'kysely'
import { db } from '../../core/db/index.js'
import type { DB, TxnStatus } from '../../core/db/types.js'

type Conn = Kysely<DB> | Trx<DB>

export interface CardRow {
  id: string
  number: string
  label: string
  holderId: string
  remindersOn: boolean
  holderName: string
  holderEmail: string
}

export function listCards(conn: Conn = db): Promise<CardRow[]> {
  return conn
    .selectFrom('cards')
    .innerJoin('users', 'users.id', 'cards.holderId')
    .select([
      'cards.id',
      'cards.number',
      'cards.label',
      'cards.holderId',
      'cards.remindersOn',
      'users.name as holderName',
      'users.email as holderEmail',
    ])
    .orderBy('users.name')
    .execute()
}

export function findCard(id: string, conn: Conn = db) {
  return conn.selectFrom('cards').selectAll().where('id', '=', id).executeTakeFirst()
}

export interface TransactionListRow {
  id: string
  cardNumber: string
  cardId: string | null
  effectiveDate: Date
  postingDate: Date | null
  amountPaise: number
  description: string
  category: string
  status: TxnStatus
  remarks: string
  invoiceName: string
  invoiceUrl: string
  invoiceKey: string
  tags: string
  reviewedAt: Date | null
  reviewedBy: string | null
  updatedAt: Date
  holderId: string | null
  holderName: string | null
}

export function listTransactions(conn: Conn = db): Promise<TransactionListRow[]> {
  return conn
    .selectFrom('transactions')
    .leftJoin('cards', 'cards.id', 'transactions.cardId')
    .leftJoin('users', 'users.id', 'cards.holderId')
    .select([
      'transactions.id',
      'transactions.cardNumber',
      'transactions.cardId',
      'transactions.effectiveDate',
      'transactions.postingDate',
      'transactions.amountPaise',
      'transactions.description',
      'transactions.category',
      'transactions.status',
      'transactions.remarks',
      'transactions.invoiceName',
      'transactions.invoiceUrl',
      'transactions.invoiceKey',
      'transactions.tags',
      'transactions.reviewedAt',
      'transactions.reviewedBy',
      'transactions.updatedAt',
    ])
    .select(sql<string | null>`cards."holderId"`.as('holderId'))
    .select(sql<string | null>`users.name`.as('holderName'))
    .orderBy('transactions.effectiveDate', 'desc')
    .orderBy('transactions.createdAt', 'desc')
    .execute() as Promise<TransactionListRow[]>
}

export function findTransaction(id: string, conn: Conn = db) {
  return conn.selectFrom('transactions').selectAll().where('id', '=', id).executeTakeFirst()
}

/** Holder of the card a transaction is matched to (null when unassigned). */
export async function transactionHolderId(id: string, conn: Conn = db): Promise<string | null> {
  const row = await conn
    .selectFrom('transactions')
    .leftJoin('cards', 'cards.id', 'transactions.cardId')
    .select(sql<string | null>`cards."holderId"`.as('holderId'))
    .where('transactions.id', '=', id)
    .executeTakeFirst()
  return row?.holderId ?? null
}

export async function isHelperOf(holderId: string, helperId: string, conn: Conn = db): Promise<boolean> {
  const row = await conn
    .selectFrom('card_helpers')
    .select('id')
    .where('holderId', '=', holderId)
    .where('helperId', '=', helperId)
    .executeTakeFirst()
  return Boolean(row)
}

export interface HelperRow {
  id: string
  holderId: string
  helperId: string
  helperName: string
  helperEmail: string
}

export function listHelpersOf(holderId: string, conn: Conn = db): Promise<HelperRow[]> {
  return conn
    .selectFrom('card_helpers')
    .innerJoin('users', 'users.id', 'card_helpers.helperId')
    .select([
      'card_helpers.id',
      'card_helpers.holderId',
      'card_helpers.helperId',
      'users.name as helperName',
      'users.email as helperEmail',
    ])
    .where('card_helpers.holderId', '=', holderId)
    .orderBy('users.name')
    .execute()
}

/** The holders this user helps: [{holderId, holderName}]. */
export function listHelpingFor(helperId: string, conn: Conn = db) {
  return conn
    .selectFrom('card_helpers')
    .innerJoin('users', 'users.id', 'card_helpers.holderId')
    .select(['card_helpers.holderId', 'users.name as holderName'])
    .where('card_helpers.helperId', '=', helperId)
    .execute()
}
