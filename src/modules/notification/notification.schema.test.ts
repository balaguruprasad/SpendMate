import { describe, it, expect, vi } from 'vitest'
import * as repo from './notification.repository.js'
import * as service from './notification.service.js'

describe('notification.service.markRead', () => {
  it("404s when the notification belongs to someone else", async () => {
    vi.spyOn(repo, 'findById').mockResolvedValueOnce({
      id: 'n1',
      userId: 'other-user',
    } as never)
    await expect(service.markRead('n1', 'me')).rejects.toMatchObject({ status: 404 })
  })

  it('404s when the notification does not exist', async () => {
    vi.spyOn(repo, 'findById').mockResolvedValueOnce(undefined)
    await expect(service.markRead('missing', 'me')).rejects.toMatchObject({ status: 404 })
  })

  it('returns the updated row when owned', async () => {
    const row = { id: 'n1', userId: 'me', readAt: null } as never
    const updated = { id: 'n1', userId: 'me', readAt: new Date() } as never
    vi.spyOn(repo, 'findById').mockResolvedValueOnce(row)
    vi.spyOn(repo, 'markRead').mockResolvedValueOnce(updated)
    await expect(service.markRead('n1', 'me')).resolves.toBe(updated)
  })
})

describe('notification.service.listMine', () => {
  it('combines items + unreadCount', async () => {
    vi.spyOn(repo, 'listForUser').mockResolvedValueOnce([{ id: 'n1' }] as never)
    vi.spyOn(repo, 'unreadCount').mockResolvedValueOnce(3)
    await expect(service.listMine('me')).resolves.toEqual({ items: [{ id: 'n1' }], unreadCount: 3 })
  })
})
