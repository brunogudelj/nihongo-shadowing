// Osnove glagola za zaslon Oblici. Čiste funkcije, pa se mogu testirati.
import { conjugate, type ConjWord } from './conjugate'

// Osnove glagola (a / i / u / e / o i te-oblik), izvedene iz oblika koje računa konjugator,
// pa vrijede i za nepravilne (来る: こ / き / く / く / こ). Za svaki oblik: od koje osnove nastaje.
export type Base = 'a' | 'i' | 'u' | 'e' | 'o' | 'te'
export const BASES: { id: Base; label: string; from: string; strip: string; uses: string }[] = [
  { id: 'a', label: 'a-oblik', from: 'nai', strip: 'ない', uses: '～ない, ～なかった, ～れる (pasiv), ～せる (kauzativ); ichidan i 来る: ～られる (mogućnost)' },
  { id: 'i', label: 'i-oblik', from: 'masu', strip: 'ます', uses: '～ます (i svi uljudni), ～たい' },
  { id: 'u', label: 'u-oblik', from: '', strip: '', uses: 'rječnički oblik' },
  { id: 'e', label: 'e-oblik', from: 'ba', strip: 'ば', uses: '～ば (uvjet), mogućnost (godan: + る)' },
  { id: 'o', label: 'o-oblik', from: 'volitional', strip: 'う', uses: '～う (namjera; ichidan: + よう)' },
  { id: 'te', label: 'te-oblik', from: 'te', strip: '', uses: '～て, ～た (て → た)' },
]
export const FORM_BASE: Record<string, Base> = {
  masu: 'i', masen: 'i', mashita: 'i', masendeshita: 'i', tai: 'i',
  nai: 'a', nakatta: 'a', passive: 'a', causative: 'a',
  ba: 'e', potential: 'e', volitional: 'o', te: 'te', ta: 'te',
}

// Osnova za oblik; mogućnost je kod godan od e-oblika (行ける), kod ostalih od a-oblika (食べられる, 来られる).
export function baseFor(w: ConjWord, formId: string): Base | undefined {
  if (formId === 'potential' && !['godan', 'iku', 'aru'].includes(w.class)) return 'a'
  return FORM_BASE[formId]
}

export function stemOf(w: ConjWord, b: (typeof BASES)[number]): { written: string; reading: string } {
  if (!b.from) return { written: w.word, reading: w.reading }
  const r = conjugate(w, b.from)
  // Namjera: godan ～う (行こう → 行こ), ostali ～よう (食べよう → 食べ, しよう → し).
  const strip = b.id === 'o' && !['godan', 'iku', 'aru'].includes(w.class) ? 'よう' : b.strip
  const cut = (t: string) => (strip && t.endsWith(strip) ? t.slice(0, -strip.length) : t)
  return { written: cut(r.written), reading: cut(r.reading) }
}
