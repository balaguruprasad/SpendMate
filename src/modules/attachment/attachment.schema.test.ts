import { describe, it, expect } from 'vitest'
import {
  signUploadBody,
  registerAttachmentBody,
  embeddedAttachmentSchema,
  listAttachmentsQuery,
  MAX_FILE_BYTES,
} from './attachment.schema.js'

const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

describe('signUploadBody', () => {
  it('accepts a valid PDF request', () => {
    const r = signUploadBody.safeParse({
      entityType: 'TRANSACTION',
      fileName: 'inv.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    })
    expect(r.success).toBe(true)
  })

  it('rejects an unsupported mime type', () => {
    const r = signUploadBody.safeParse({
      entityType: 'TRANSACTION',
      fileName: 'a.txt',
      mimeType: 'text/plain',
      sizeBytes: 1024,
    })
    expect(r.success).toBe(false)
  })

  it('rejects a file over the size limit', () => {
    const r = signUploadBody.safeParse({
      entityType: 'TRANSACTION',
      fileName: 'big.png',
      mimeType: 'image/png',
      sizeBytes: MAX_FILE_BYTES + 1,
    })
    expect(r.success).toBe(false)
  })

  it('rejects an unknown entity type', () => {
    const r = signUploadBody.safeParse({
      entityType: 'WIDGET',
      fileName: 'a.png',
      mimeType: 'image/png',
      sizeBytes: 1,
    })
    expect(r.success).toBe(false)
  })
})

describe('registerAttachmentBody', () => {
  it('accepts a valid registration', () => {
    const r = registerAttachmentBody.safeParse({
      entityType: 'TRANSACTION',
      entityId: uuid,
      gcsKey: 'mesa-finance/invoice/abc-file.pdf',
      fileName: 'file.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-uuid entityId', () => {
    const r = registerAttachmentBody.safeParse({
      entityType: 'TRANSACTION',
      entityId: 'not-a-uuid',
      gcsKey: 'k',
      fileName: 'f.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1,
    })
    expect(r.success).toBe(false)
  })
})

describe('embeddedAttachmentSchema', () => {
  it('accepts a valid embedded attachment', () => {
    const r = embeddedAttachmentSchema.safeParse({
      gcsKey: 'mesa-finance/vendor/x-y.png',
      fileName: 'y.png',
      mimeType: 'image/png',
      sizeBytes: 500,
    })
    expect(r.success).toBe(true)
  })

  it('rejects a bad mime', () => {
    expect(
      embeddedAttachmentSchema.safeParse({
        gcsKey: 'k',
        fileName: 'y.gif',
        mimeType: 'image/gif',
        sizeBytes: 500,
      }).success,
    ).toBe(false)
  })
})

describe('listAttachmentsQuery', () => {
  it('accepts entityType + entityId', () => {
    expect(listAttachmentsQuery.safeParse({ entityType: 'TRANSACTION', entityId: uuid }).success).toBe(true)
  })

  it('rejects a missing entityId', () => {
    expect(listAttachmentsQuery.safeParse({ entityType: 'TRANSACTION' }).success).toBe(false)
  })
})
