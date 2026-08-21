# SpendMate — frontend

Mesa's credit-card invoice tracker (rebuilt from the G-Sheets/Apps Script v2 app).
Next.js 16 + Tailwind v4 + shadcn/ui, sharing the Mesa Finance design system.

## Local development

```bash
npm install
npm run dev        # http://localhost:3100 (backend expected on :4100)
```

Login (seeded): `bala@mesaschool.co` (admin), `gaurav@mesaschool.co` /
`varun@mesaschool.co` (cardholders) — password `Mesa@2026!`.

Workspaces: `/admin/*` (charges, import, cards, settings, users, audit) and
`/member/charges` (cardholder + helper view).
