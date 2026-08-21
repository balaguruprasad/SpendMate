import { Router } from 'express'
import * as controller from './spend.controller.js'
import { requireAuth, requireRole } from '../../core/auth/rbac.js'

const r = Router()
r.use(requireAuth)

const anyUser = requireRole('ADMIN', 'MEMBER')
const admin = requireRole('ADMIN')

// Who am I in SpendMate: my cards, who I help, my helpers, settings.
r.get('/me', anyUser, controller.getMe)

// Charges — members see their own + the cardholders they help; admin sees all.
r.get('/transactions', anyUser, controller.listTransactions)
r.patch('/transactions/:id', anyUser, controller.updateTransaction)
r.post('/transactions/:id/invoice', anyUser, controller.attachInvoice)
r.post('/transactions/import', admin, controller.importTransactions)

// Cards — admin manages who owns which card.
r.get('/cards', admin, controller.listCards)
r.post('/cards', admin, controller.createCard)
r.patch('/cards/:id', admin, controller.updateCard)
r.delete('/cards/:id', admin, controller.deleteCard)

// Invoice helpers — a cardholder manages their own list.
r.post('/helpers', anyUser, controller.addHelper)
r.delete('/helpers/:id', anyUser, controller.removeHelper)

// Settings (categories + the configurable Tag dropdown).
r.get('/settings', anyUser, controller.getSettings)
r.put('/settings', admin, controller.saveSettings)

// Reminders — in-app notifications (+ email in prod when SMTP is configured).
r.post('/reminders/send', admin, controller.sendReminders)
r.get('/reminders', admin, controller.reminderInfo)

// Presence (avatar bar) + admin login-activity panel.
r.post('/presence', anyUser, controller.presencePing)
r.get('/logins', admin, controller.loginActivity)

export const spendRouter = r
