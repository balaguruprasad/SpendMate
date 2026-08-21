import { describe, it, expect } from 'vitest'
import { listAuditQuery } from './audit.schema.js'
import { encodeCursor, decodeCursor } from './audit.repository.js'

describe('listAuditQuery', () => {
  it('defaults limit to 20 and leaves filters undefined', () => {
    const r = listAuditQuery.parse({})
    expect(r.limit).toBe(20)
    expect(r.entityType).toBeUndefined()
    expect(r.entityId).toBeUndefined()
    expect(r.action).toBeUndefined()
  })

  it('coerces limit and accepts filters', () => {
    const r = listAuditQuery.parse({ limit: '50', entityType: 'INVOICE', action: 'PAID' })
    expect(r.limit).toBe(50)
    expect(r.entityType).toBe('INVOICE')
    expect(r.action).toBe('PAID')
  })

  it('rejects limit > 100', () => {
    expect(listAuditQuery.safeParse({ limit: '101' }).success).toBe(false)
  })
})

describe('audit cursor', () => {
  it('round-trips createdAt + id', () => {
    const now = new Date('2026-06-07T10:00:00.000Z')
    const enc = encodeCursor({ createdAt: now, id: 'abc' })
    expect(decodeCursor(enc)).toEqual({ createdAt: now.toISOString(), id: 'abc' })
  })

  it('returns null for a malformed cursor', () => {
    expect(decodeCursor('!!!not-base64!!!')).toBeNull()
  })
})
