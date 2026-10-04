// Sigurnosna kopija napretka: sve tablice iz baze (moje riječi, a kasnije i kartice, status rečenica…)
// u jednu JSON datoteku, i natrag. Uvoz spaja: dodaje i osvježava, ništa ne briše.
import { db } from './db'

const APP = 'nihongo-shadowing'

type Backup = { app: string; version: number; exportedAt: string; tables: Record<string, unknown[]> }

export async function exportBackup(): Promise<{ file: string; counts: Record<string, number> }> {
  const tables: Record<string, unknown[]> = {}
  for (const table of db.tables) tables[table.name] = await table.toArray()
  const backup: Backup = { app: APP, version: db.verno, exportedAt: new Date().toISOString(), tables }
  const file = `nihongo-napredak-${backup.exportedAt.slice(0, 10)}.json`
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = file
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { file, counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])) }
}

export async function importBackup(file: File): Promise<Record<string, number>> {
  let backup: Backup
  try {
    backup = JSON.parse(await file.text())
  } catch {
    throw new Error('Datoteka nije ispravna sigurnosna kopija (nije JSON).')
  }
  if (backup?.app !== APP || typeof backup.tables !== 'object') {
    throw new Error('Ovo nije sigurnosna kopija ove aplikacije.')
  }
  const counts: Record<string, number> = {}
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      const rows = backup.tables[table.name]
      if (!Array.isArray(rows)) continue
      await table.bulkPut(rows)
      counts[table.name] = rows.length
    }
  })
  return counts
}
