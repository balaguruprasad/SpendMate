import { NotFoundError } from '../../core/errors/index.js'
import * as repo from './notification.repository.js'
import type { NotificationRow } from './notification.types.js'

export { createNotification } from '../../core/notify/index.js'

export async function listMine(
  userId: string,
): Promise<{ items: NotificationRow[]; unreadCount: number }> {
  const [items, unreadCount] = await Promise.all([
    repo.listForUser(userId),
    repo.unreadCount(userId),
  ])
  return { items, unreadCount }
}

export async function markRead(id: string, userId: string): Promise<NotificationRow> {
  // Hide ownership: a notification belonging to someone else 404s rather than 403s.
  const existing = await repo.findById(id)
  if (!existing || existing.userId !== userId) throw new NotFoundError('Notification not found')
  const updated = await repo.markRead(id, userId)
  // Already read (or raced) → return the current row.
  return updated ?? existing
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const updated = await repo.markAllRead(userId)
  return { updated }
}
