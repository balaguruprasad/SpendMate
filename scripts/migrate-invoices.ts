/**
 * Second-pass migration: pull every invoice file still pointing at Google
 * Drive into SpendMate's own storage (GCS), create the attachments row, and
 * rewrite the transaction's invoice link to the app's download route.
 *
 *   npx tsx scripts/migrate-invoices.ts
 *
 * Idempotent: only touches transactions whose invoiceUrl is a Drive link;
 * successful rows get an /api/... link and are skipped on re-runs. Failures
 * keep their Drive link and are listed at the end.
 */
import { db } from '../src/core/db/index.js'
import { buildKey, uploadBuffer } from '../src/core/storage/gcs.js'

function driveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([\w-]+)/)
  if (m1) return m1[1]!
  const m2 = url.match(/[?&]id=([\w-]+)/)
  if (m2) return m2[1]!
  return null
}

function extToMime(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  return (
    {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      heic: 'image/heic',
    }[ext] ?? 'application/octet-stream'
  )
}

/** Download a link-shared Drive file, following the virus-scan interstitial. */
async function downloadDriveFile(fileId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const direct = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, {
    redirect: 'follow',
  })
  if (!direct.ok) return null
  let contentType = direct.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) {
    return { buffer: Buffer.from(await direct.arrayBuffer()), contentType }
  }
  // Interstitial (large files): scrape the confirm form and hit it.
  const html = await direct.text()
  if (/accounts\.google\.com/.test(html)) return null // sign-in wall — not shared
  const action = html.match(/action="([^"]*drive\.usercontent\.google\.com\/download[^"]*)"/)?.[1]
  const inputs = [...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"/g)]
  if (!action) return null
  const qs = new URLSearchParams()
  for (const [, name, value] of inputs) qs.set(name!, value!)
  const confirmed = await fetch(`${action.replaceAll('&amp;', '&')}?${qs.toString()}`, {
    redirect: 'follow',
  })
  if (!confirmed.ok) return null
  contentType = confirmed.headers.get('content-type') ?? ''
  if (contentType.includes('text/html')) return null
  return { buffer: Buffer.from(await confirmed.arrayBuffer()), contentType }
}

async function main(): Promise<void> {
  const rows = await db
    .selectFrom('transactions')
    .select(['id', 'invoiceName', 'invoiceUrl'])
    .where('invoiceUrl', 'like', 'https://drive.google.com%')
    .execute()
  console.log(`${rows.length} transaction(s) with Drive invoice links.`)

  let migrated = 0
  const failures: string[] = []

  for (const [i, row] of rows.entries()) {
    const fileId = driveFileId(row.invoiceUrl)
    if (!fileId) {
      failures.push(`${row.id}: unrecognized Drive URL ${row.invoiceUrl}`)
      continue
    }
    const fileName = row.invoiceName || `invoice-${fileId}`
    try {
      const file = await downloadDriveFile(fileId)
      if (!file) {
        failures.push(`${row.id}: download failed (${fileName})`)
        continue
      }
      const mimeType =
        file.contentType && !file.contentType.includes('octet-stream')
          ? file.contentType.split(';')[0]!.trim()
          : extToMime(fileName)
      const key = buildKey('TRANSACTION', fileName)
      await uploadBuffer(key, file.buffer, mimeType)
      await db.transaction().execute(async (trx) => {
        const att = await trx
          .insertInto('attachments')
          .values({
            entityType: 'TRANSACTION',
            entityId: row.id,
            storageKey: key,
            fileName,
            mimeType,
            sizeBytes: file.buffer.length,
            uploadedBy: null,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
        await trx
          .updateTable('transactions')
          .set({ invoiceKey: key, invoiceUrl: `/api/v1/attachments/${att.id}/download` })
          .where('id', '=', row.id)
          .execute()
      })
      migrated++
      if ((i + 1) % 20 === 0) console.log(`  … ${i + 1}/${rows.length}`)
    } catch (e) {
      failures.push(`${row.id}: ${e instanceof Error ? e.message : String(e)} (${fileName})`)
    }
  }

  console.log(`\nMigrated ${migrated}/${rows.length} invoice file(s) into app storage.`)
  if (failures.length) {
    console.log(`${failures.length} kept their Drive link:`)
    for (const f of failures.slice(0, 15)) console.log('  ' + f)
    if (failures.length > 15) console.log(`  … and ${failures.length - 15} more`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
