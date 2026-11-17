// Zajedničko aplikaciji (stranica Pisanje) i pipelineu (izgovor): kako se tekst iz plana pisanja
// rastavlja na dijelove za dodir i što se točno izgovara. Isto pravilo na oba mjesta, pa ime mp3
// datoteke (speechId) uvijek odgovara.

// Što se izgovara: tekst bez razmaka (rečenice u planu imaju razmake između riječi).
export const sayable = (s: string) => s.replace(/[\s　]/g, '')

// Znakovi koji sami nemaju izgovor.
const SILENT = new Set(['っ', 'ッ', 'ー', 'ゃ', 'ゅ', 'ょ', 'ャ', 'ュ', 'ョ', '゛', '゜', '゛゜', '一'])
export const hasSound = (s: string) => !SILENT.has(s) && /^[ぁ-ゖァ-ヺー]+[ぁ-ゖァ-ヺー。]*$/.test(sayable(s))

// Niz slova iz plana ("あいうえお かきくけこ", "きゃ きゅ", "ぬ/め") → skupine slova za dodir.
// Skupina dulja od 2 znaka je red slova (svako slovo posebno); 2 znaka su kombinacija (きゃ, ティ).
export function letterGroups(text: string): string[][] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => (tok.includes('/') ? tok.split('/').filter(Boolean) : tok.length > 2 ? [...tok] : [tok]))
}

// Riječ ili rješenje može imati više dijelova ("はし / ほし").
export const parts = (s: string) =>
  s
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean)

type PlanForSpeech = {
  dani: {
    tablicaNapamet: { slova: string } | null
    novaSlova: string | null
    rijeci: { kana: string }[]
    oblici: { redovi: { glagol: string; oblici: (string | null)[] }[] } | null
    diktat: { ja: string }[] | null
    recenice: { ja: string }[] | null
  }[]
}

// Svi tekstovi iz plana koji trebaju izgovor (za pipeline).
export function speechTexts(plan: PlanForSpeech): Set<string> {
  const out = new Set<string>()
  const add = (s: string | null | undefined) => {
    if (s && hasSound(s)) out.add(sayable(s))
  }
  for (const d of plan.dani) {
    for (const t of [d.tablicaNapamet?.slova, d.novaSlova]) if (t) letterGroups(t).flat().forEach(add)
    for (const r of d.rijeci) parts(r.kana).forEach(add)
    for (const r of d.oblici?.redovi ?? []) [r.glagol, ...r.oblici].forEach(add)
    for (const p of [...(d.diktat ?? []), ...(d.recenice ?? [])]) parts(p.ja).forEach(add)
  }
  return out
}
