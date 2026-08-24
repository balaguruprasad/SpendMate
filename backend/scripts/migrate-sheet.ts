/**
 * One-time migration: import the v2 Google-Sheet "Transactions" tab into
 * SpendMate, preserving EVERYTHING the sheet held — card, dates, amount,
 * description, category, status, remarks, invoice name + Drive URL, and the
 * Department tag. Cards match by last-4 (deactivated cards included).
 *
 *   npx tsx scripts/migrate-sheet.ts <path-to-transactions.csv> [--force]
 *
 * Safety: refuses to run when the transactions table already has rows,
 * unless --force is passed. Also replaces the Settings row's categories +
 * Department options with the sheet's real ones.
 */
import fs from 'node:fs'
import { db } from '../src/core/db/index.js'
import type { TxnStatus } from '../src/core/db/types.js'

const CATEGORIES = ['Markup Charges', 'GST', 'Others', 'Transaction charges']
const TAG_LABEL = 'Department'
const TAG_OPTIONS = [
  'PG-Admissions', 'PG-Program', 'UG-Admissions', 'UG-Program',
  'Forge-Admissions', 'Forge-Program', 'FFP-Admissions', 'FFP-Program',
  'Careers-Preparations', 'Careers-Partnerships', 'MSL', 'Others',
]

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    const nx = text[i + 1]
    if (ch === '"') {
      if (q && nx === '"') { cur += '"'; i++ } else q = !q
    } else if (ch === ',' && !q) {
      row.push(cur); cur = ''
    } else if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && nx === '\n') i++
      row.push(cur); cur = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else cur += ch
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows
}

function mapStatus(raw: string): TxnStatus {
  const s = raw.trim().toLowerCase()
  if (s === 'submitted') return 'SUBMITTED'
  if (s === 'no invoice needed') return 'NO_INVOICE_NEEDED'
  return 'PENDING'
}

/** "2026-05-11 0:00:00" | "11/05/2026" | "2026-05-11" → Date, else null. */
function parseDate(raw: string): Date | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const isoish = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoish) return new Date(`${isoish[1]}-${isoish[2]}-${isoish[3]}`)
  const mdY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (mdY) return new Date(`${mdY[3]}-${mdY[1]!.padStart(2, '0')}-${mdY[2]!.padStart(2, '0')}`)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

async function main(): Promise<void> {
  const csvPath = process.argv[2]
  const force = process.argv.includes('--force')
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage: npx tsx scripts/migrate-sheet.ts <transactions.csv> [--force]')
    process.exit(1)
  }

  const existing = await db
    .selectFrom('transactions')
    .select(db.fn.countAll().as('n'))
    .executeTakeFirst()
  if (Number(existing?.n ?? 0) > 0 && !force) {
    console.error(`transactions already has ${existing!.n} rows — pass --force to append anyway.`)
    process.exit(1)
  }

  const cards = await db.selectFrom('cards').select(['id', 'number']).execute()
  const cardByLast4 = new Map(cards.map((c) => [c.number.replace(/\D/g, '').slice(-4), c.id]))

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8')).slice(1)
  let inserted = 0
  let skippedBlank = 0
  const warnings: string[] = []
  const perCard = new Map<string, number>()

  for (let i = 0; i < rows.length; i++) {
    const [card = '', eff = '', post = '', amt = '', desc = '', cat = '', st = '', rem = '',
      invName = '', invUrl = '', upd = '', tag = ''] = rows[i]!.map((c) => (c ?? '').trim())

    const last4 = card.replace(/\D/g, '').slice(-4)
    if (!last4 && !desc) { skippedBlank++; continue }

    const effectiveDate = parseDate(eff)
    const amount = Number(amt.replace(/[^0-9.-]/g, ''))
    if (!effectiveDate || !Number.isFinite(amount)) {
      warnings.push(`row ${i + 2}: bad date/amount ("${eff}" / "${amt}") — skipped`)
      continue
    }

    const cardId = cardByLast4.get(last4) ?? null
    if (!cardId && last4) warnings.push(`row ${i + 2}: card •••• ${last4} not found — imported as Unassigned`)

    const tags = tag.split(',').map((s) => s.trim()).filter(Boolean).join(', ')
    await db
      .insertInto('transactions')
      .values({
        cardNumber: last4 || card,
        cardId,
        effectiveDate,
        postingDate: parseDate(post),
        amountPaise: Math.round(amount * 100),
        description: desc,
        category: cat,
        status: mapStatus(st),
        remarks: rem,
        invoiceName: invName,
        invoiceKey: '',
        // Drive link preserved — the UI opens absolute URLs directly. A later
        // pass can pull the binaries into GCS once the Drive folder is shared.
        invoiceUrl: invUrl,
        tags,
        updatedAt: parseDate(upd) ?? new Date(),
      })
      .execute()
    inserted++
    perCard.set(last4 || '(none)', (perCard.get(last4 || '(none)') ?? 0) + 1)
  }

  // Settings: the sheet's REAL dropdowns replace the scaffold defaults.
  await db
    .insertInto('app_settings')
    .values({
      key: 'spend',
      value: JSON.stringify({ categories: CATEGORIES, tagLabel: TAG_LABEL, tagOptions: TAG_OPTIONS }),
      updatedAt: new Date(),
    })
    .onConflict((oc) =>
      oc.column('key').doUpdateSet({
        value: JSON.stringify({ categories: CATEGORIES, tagLabel: TAG_LABEL, tagOptions: TAG_OPTIONS }),
        updatedAt: new Date(),
      }),
    )
    .execute()

  console.log(`\nImported ${inserted} transactions (${skippedBlank} blank rows skipped).`)
  console.log('Per card:', [...perCard.entries()].map(([k, v]) => `${k}:${v}`).join('  '))
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`)
    for (const w of warnings.slice(0, 20)) console.log('  ' + w)
    if (warnings.length > 20) console.log(`  … and ${warnings.length - 20} more`)
  }
  console.log('Settings updated: categories + Department options from the sheet.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
