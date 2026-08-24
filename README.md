# SpendMate

Mesa's credit-card invoice tracker — the Google-Sheets/Apps-Script tool rebuilt as a proper app.

| Folder | What it is | Local dev |
|---|---|---|
| [`backend/`](backend/) | Express 5 + Kysely + Prisma API (`spendmate` Postgres DB, GCS invoice storage) | `npm run dev` → http://localhost:4100 |
| [`frontend/`](frontend/) | Next.js app (green Mesa UI: transactions, spend by month, top spends, reminders, settlements, review, reports) | `npm run dev` → http://localhost:3100 |

Copy `backend/.env.example` → `backend/.env` and fill in real values before running; secrets and the
GCS service-account key are never committed.

Planned production: Cloud Run + spendmate.mesaschool.co.in (like Mesa Finance).
