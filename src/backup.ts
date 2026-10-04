// Sigurnosna kopija napretka (dorada 1): sve tablice iz baze (moje riječi, statusi rečenica, mjesta
// u pričama, a kasnije i kartice) i postavke, u jednu JSON datoteku, i natrag.
//
// Format je verzioniran (formatVersion). Starije datoteke se migriraju, novije se odbijaju.
// Uvoz: "spoji" dodaje samo ono čega nema (postojeće ne dira), "zamijeni" briše trenutno i stavlja kopiju.
// Neispravna datoteka ne mijenja ništa: prvo se cijela provjeri, a zatim se primijeni u jednoj transakciji.
import { db } from './db'
import { allSettings, applySettings } from './settings'

export const APP = 'nihongo-shadowing'
export const FORMAT_VERSION = 2

export type Backup = {
  app: string
  formatVersion: number
  exportedAt: string
  tables: Record<string, unknown[]>
  settings: Record<string, string>
}

export type ImportMode = 'spoji' | 'zamijeni'

export class BackupError extends Error {}

export async function buildBackup(): Promise<Backup> {
  const tables: Record<string, unknown[]> = {}
  for (const table of db.tables) tables[table.name] = await table.toArray()
  return { app: APP, formatVersion: FORMAT_VERSION, exportedAt: new Date().toISOString(), tables, settings: allSettings() }
}

export const backupFileName = (b: Backup) => `japanski-backup-${b.exportedAt.slice(0, 10)}.json`

// Izvoz: datoteka u Preuzimanja.
export async function exportBackup(): Promise<Backup> {
  const backup = await buildBackup()
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName(backup)
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return backup
}

// Pročitaj i provjeri datoteku; po potrebi je migriraj na trenutni format. Ništa ne sprema.
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('Datoteka nije ispravna sigurnosna kopija (nije JSON).')
  }
  const b = raw as Partial<Backup> & { version?: number }
  if (!b || typeof b !== 'object' || b.app !== APP) throw new BackupError('Ovo nije sigurnosna kopija ove aplikacije.')

  // Verzija 1 (prije formatVersion): { app, version (verzija baze), exportedAt, tables }, bez postavki.
  const version = b.formatVersion ?? (b.tables ? 1 : undefined)
  if (version === undefined) throw new BackupError('Datoteka nema podatke.')
  if (version > FORMAT_VERSION) {
    throw new BackupError('Datoteka je iz novije verzije aplikacije. Prvo osvježi aplikaciju, pa uvezi ponovno.')
  }

  const tables = b.tables
  if (!tables || typeof tables !== 'object' || Object.values(tables).some((rows) => !Array.isArray(rows))) {
    throw new BackupError('Datoteka je oštećena (podaci nisu u očekivanom obliku).')
  }
  return {
    app: APP,
    formatVersion: FORMAT_VERSION,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    tables,
    settings: version >= 2 && b.settings && typeof b.settings === 'object' ? b.settings : {},
  }
}

// Primijeni kopiju na bazu i postavke. Vrati koliko je redaka po tablici dodano (ili stavljeno).
export async function applyBackup(backup: Backup, mode: ImportMode): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      const rows = backup.tables[table.name]
      if (mode === 'zamijeni') {
        await table.clear()
        if (rows?.length) await table.bulkPut(rows)
        counts[table.name] = rows?.length ?? 0
        continue
      }
      if (!rows?.length) continue
      // Spoji: dodaj samo retke kojih nema (po ključu), postojeće ne diraj.
      const keyPath = table.schema.primKey.keyPath as string
      const existing = new Set((await table.toCollection().primaryKeys()).map(String))
      const missing = rows.filter((r) => !existing.has(String((r as Record<string, unknown>)[keyPath])))
      if (missing.length) await table.bulkAdd(missing)
      counts[table.name] = missing.length
    }
  })
  counts.postavke = applySettings(backup.settings, mode)
  return counts
}

// Sažetak sadržaja kopije (za prikaz prije uvoza).
export function summarize(backup: Backup): Record<string, number> {
  return {
    ...Object.fromEntries(Object.entries(backup.tables).map(([k, v]) => [k, v.length])),
    postavke: Object.keys(backup.settings).length,
  }
}
