import { describe, expect, it } from 'vitest'
import { createUserBody, updateUserBody } from './user.schema.js'

describe('user schemas', () => {
  it('trims and lowercases on create', () => {
    const parsed = createUserBody.parse({
      name: '  QA Test  ',
      email: '  QA.Test@Mesaschool.CO ',
      role: 'MEMBER',
      password: 'Test@2026!',
    })
    expect(parsed.name).toBe('QA Test')
    expect(parsed.email).toBe('qa.test@mesaschool.co')
  })

  it('rejects a password shorter than 8 chars', () => {
    expect(
      createUserBody.safeParse({ name: 'QA', email: 'a@b.co', role: 'MEMBER', password: 'short' }).success,
    ).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(
      createUserBody.safeParse({ name: 'QA', email: 'not-an-email', role: 'MEMBER', password: 'Test@2026!' })
        .success,
    ).toBe(false)
  })

  it('rejects roles outside ADMIN/MEMBER', () => {
    expect(
      createUserBody.safeParse({ name: 'QA', email: 'a@b.co', role: 'CREATOR', password: 'Test@2026!' })
        .success,
    ).toBe(false)
  })

  it('update accepts partial patches', () => {
    expect(updateUserBody.safeParse({ isActive: false }).success).toBe(true)
    expect(updateUserBody.safeParse({ role: 'ADMIN' }).success).toBe(true)
  })
})
