import { describe, it, expect } from 'vitest'
import { impersonateBody } from './admin.schema.js'

const UUID = '4f8e2c1a-9b3d-4a6e-8c2f-1d5b7e9a0c34'

describe('impersonateBody', () => {
  it('accepts a valid userId', () => {
    expect(impersonateBody.parse({ userId: UUID }).userId).toBe(UUID)
  })

  it('rejects a non-uuid userId', () => {
    expect(impersonateBody.safeParse({ userId: 'nope' }).success).toBe(false)
  })

  it('rejects a missing userId', () => {
    expect(impersonateBody.safeParse({}).success).toBe(false)
  })
})
