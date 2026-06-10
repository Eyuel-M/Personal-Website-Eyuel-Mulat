/**
 * Content persistence layer — syncs /content/*.json files to/from Neon PostgreSQL.
 * Gracefully no-ops when DATABASE_URL is not set (local dev without a DB).
 *
 * Usage in server.js standalone block:
 *   patchFsWrites(CONTENT_DIR)   // must come first — intercepts all future writes
 *   await restoreFromDb(CONTENT_DIR)  // pulls saved content from DB onto disk
 */

import fs from 'fs'
import path from 'path'

let _prisma = null
async function db() {
  if (_prisma) return _prisma
  const { PrismaClient } = await import('@prisma/client')
  _prisma = new PrismaClient()
  return _prisma
}

/** On startup: pull every saved KV row from the DB and write it to disk. */
export async function restoreFromDb(contentDir) {
  if (!process.env.DATABASE_URL) return
  try {
    const client = await db()
    const rows = await client.kvStore.findMany()
    for (const row of rows) {
      const filePath = path.join(contentDir, row.key)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, JSON.stringify(row.value, null, 2))
    }
    if (rows.length) console.log(`  ◆ Content restored from DB (${rows.length} files)`)
  } catch (e) {
    console.warn('  ◆ DB restore skipped:', e.message)
  }
}

/** Install a transparent patch on fs.writeFileSync that mirrors every write
 *  inside contentDir to the kv_store table — fire-and-forget, never blocks. */
export function patchFsWrites(contentDir) {
  if (!process.env.DATABASE_URL) return
  const _orig = fs.writeFileSync.bind(fs)
  fs.writeFileSync = (filePath, data, options) => {
    _orig(filePath, data, options)
    const fp = String(filePath)
    if (!fp.startsWith(contentDir) || !fp.endsWith('.json')) return
    try {
      const key = path.relative(contentDir, fp).replace(/\\/g, '/')
      const value = JSON.parse(typeof data === 'string' ? data : data.toString())
      db().then(client =>
        client.kvStore.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      ).catch(e => console.warn('DB sync error:', e.message))
    } catch {}
  }
}
