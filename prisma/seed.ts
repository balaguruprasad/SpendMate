/**
 * SpendMate seed — idempotent. Creates the admin + demo cardholders, their
 * cards, the settings row (categories + Department tag), and a few sample
 * statement rows so the app is explorable immediately.
 *
 * All users get the DEFAULT_PASSWORD below; never overwrites an existing
 * user's password.
 */
import { db } from '../src/core/db/index.js'
import { hashPassword } from '../src/core/auth/password.js'
import type { Role } from '../src/core/db/types.js'

const DEFAULT_PASSWORD = 'Mesa@2026!'

const USERS: { name: string; email: string; role: Role }[] = [
  { name: 'Bala', email: 'bala@mesaschool.co', role: 'ADMIN' },
  { name: 'Gaurav Madan', email: 'gaurav@mesaschool.co', role: 'MEMBER' },
  { name: 'Varun Limaye', email: 'varun@mesaschool.co', role: 'MEMBER' },
]

const CARDS: { email: string; number: string; label: string }[] = [
  { email: 'gaurav@mesaschool.co', number: '4315', label: 'Corporate Visa' },
  { email: 'varun@mesaschool.co', number: '7276', label: 'Corporate Visa' },
]

const SETTINGS = {
  categories: ['Transaction charges', 'GST', 'Markup Charges', 'Software', 'Travel', 'Others'],
  tagLabel: 'Department',
  tagOptions: ['MSL', 'PGP', 'UG', 'Forge', "Founder's Office", 'Others'],
}

const SAMPLE_TXNS: {
  card: string
  effectiveDate: string
  amountPaise: number
  description: string
}[] = [
  { card: '4315', effectiveDate: '2026-08-10', amountPaise: 4720000, description: 'GOOGLE WORKSPACE SUBSCRIPTION' },
  { card: '4315', effectiveDate: '2026-08-12', amountPaise: 129900, description: 'CANVA PTY LTD' },
  { card: '4315', effectiveDate: '2026-08-15', amountPaise: 35400, description: 'GST' },
  { card: '7276', effectiveDate: '2026-08-11', amountPaise: 1852000, description: 'MAKEMYTRIP FLIGHT BLR-DEL' },
  { card: '7276', effectiveDate: '2026-08-14', amountPaise: 76700, description: 'ISSUER MARKUP ASSESSMENT' },
]

const AUTO_RULES: Record<string, { cat: string; tag: string }> = {
  gst: { cat: 'GST', tag: 'Others' },
  'issuer markup assessment': { cat: 'Markup Charges', tag: 'Others' },
}

async function main(): Promise<void> {
  const userIds: Record<string, string> = {}
  for (const u of USERS) {
    const existing = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', u.email)
      .executeTakeFirst()
    if (existing) {
      userIds[u.email] = existing.id
      continue
    }
    const row = await db
      .insertInto('users')
      .values({
        name: u.name,
        email: u.email,
        role: u.role,
        passwordHash: await hashPassword(DEFAULT_PASSWORD),
        updatedAt: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    userIds[u.email] = row.id
    console.log(`user created: ${u.email} (${u.role})`)
  }

  for (const c of CARDS) {
    const holderId = userIds[c.email]!
    const existing = await db
      .selectFrom('cards')
      .select('id')
      .where('holderId', '=', holderId)
      .where('number', '=', c.number)
      .executeTakeFirst()
    if (existing) continue
    await db
      .insertInto('cards')
      .values({ holderId, number: c.number, label: c.label, updatedAt: new Date() })
      .execute()
    console.log(`card created: ${c.email} → •••• ${c.number}`)
  }

  const settings = await db
    .selectFrom('app_settings')
    .select('key')
    .where('key', '=', 'spend')
    .executeTakeFirst()
  if (!settings) {
    await db
      .insertInto('app_settings')
      .values({ key: 'spend', value: JSON.stringify(SETTINGS), updatedAt: new Date() })
      .execute()
    console.log('settings created (categories + Department tag)')
  }

  const txnCount = await db
    .selectFrom('transactions')
    .select(db.fn.countAll().as('n'))
    .executeTakeFirst()
  if (Number(txnCount?.n ?? 0) === 0) {
    const cards = await db.selectFrom('cards').select(['id', 'number']).execute()
    for (const t of SAMPLE_TXNS) {
      const card = cards.find((c) => c.number === t.card)
      const rule = AUTO_RULES[t.description.trim().toLowerCase()]
      await db
        .insertInto('transactions')
        .values({
          cardNumber: t.card,
          cardId: card?.id ?? null,
          effectiveDate: new Date(t.effectiveDate),
          amountPaise: t.amountPaise,
          description: t.description,
          category: rule?.cat ?? '',
          status: rule ? 'NO_INVOICE_NEEDED' : 'PENDING',
          tags: rule?.tag ?? '',
          updatedAt: new Date(),
        })
        .execute()
    }
    console.log(`${SAMPLE_TXNS.length} sample transactions imported`)
  }

  console.log(`\nAll users password: "${DEFAULT_PASSWORD}"`)
  console.log('Admin: bala@mesaschool.co · Members: gaurav@mesaschool.co, varun@mesaschool.co')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
