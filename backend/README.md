# SpendMate — backend

Mesa's credit-card invoice tracker API (rebuilt from the G-Sheets/Apps Script
v2 app). Express 5 + Kysely + Prisma migrations on Postgres, JWT auth —
the same architecture as mesa-finance-backend.

## Local development

```bash
npm install
npm run db:migrate   # applies migrations to the `spendmate` database
npm run db:seed      # admin + demo cardholders/cards/settings/transactions
npm run dev          # http://localhost:4100
```

Domain model: `cards` (holder + number, matched to statement rows by
exact/last-4), `transactions` (admin-imported, append-only; the app owns
category/status/invoice/tags/remarks), `card_helpers` (a cardholder's
nominated helpers), `app_settings` (categories + the configurable Tag
dropdown). Charges count as pending until they have an invoice or a
category AND — when tags are configured — a tag. GST / ISSUER MARKUP
ASSESSMENT rows auto-categorize on import.
