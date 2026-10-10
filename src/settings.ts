// Postavke koje aplikacija pamti (u pregledniku, localStorage), na jednom mjestu.
// Ulaze i u sigurnosnu kopiju (backup.ts). Vrijednosti se spremaju kao tekst.

export const SETTING_KEYS = [
  'prikaz', // razina pomoći u priči: rendgen / puno / cisto / sluh
  'cisto', // stari zapis za Čisto (prije razine pomoći), čita se samo radi prijelaza
  'stanka', // stanka u petlji: 0, 1, 1.5, 2
  'brzina', // brzina zvuka: 0.7, 0.85, 1
  'konj-izvor', // konjugator: price / sve
  'konj-vrste', // konjugator: vrste riječi (JSON)
  'konj-oblici', // konjugator: uključeni oblici (JSON)
  'rij-izvor', // ponavljanje riječi: moje / price / sve
] as const

export type SettingKey = (typeof SETTING_KEYS)[number]

export function readSetting(key: SettingKey): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSetting(key: SettingKey, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // bez pamćenja (npr. privatni način)
  }
}

// Sve postavke koje postoje, za izvoz.
export function allSettings(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of SETTING_KEYS) {
    const v = readSetting(key)
    if (v !== null) out[key] = v
  }
  return out
}

// Postavke iz kopije: "spoji" postavlja samo one kojih nema, "zamijeni" postavlja sve iz kopije.
export function applySettings(values: Record<string, unknown>, mode: 'spoji' | 'zamijeni'): number {
  let n = 0
  for (const key of SETTING_KEYS) {
    const v = values[key]
    if (typeof v !== 'string') continue
    if (mode === 'spoji' && readSetting(key) !== null) continue
    writeSetting(key, v)
    n++
  }
  return n
}
