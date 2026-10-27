// Kazalo gramatike iz korisnikovih priča: konstrukcije (✦ formule iz pipelinea) grupirane po onome
// što se želi reći, i oblici riječi s primjerima iz rečenica. Čiste funkcije, bez zaslona.
import { conjugate, FORMS, type ConjWord } from './conjugate'
import type { Sentence, Story } from './stories'

export type Example = { storyId: string; index: number; sentence: Sentence; chunk?: number; word?: number }

// --- Konstrukcije ---

export type Construction = {
  key: string // npr. "～ので"
  label: string // naziv iz priče (prvi)
  formula?: string
  rule?: string
  examples: Example[]
}

export type Category = { id: string; title: string; test: RegExp }

// Redoslijed je važan: prva grupa koja odgovara dobiva konstrukciju (savjet prije usporedbe…).
// Provjerava se naziv konstrukcije i njezina formula.
export const CATEGORIES: Category[] = [
  { id: 'molba', title: '🙏 Molba, dopuštenje, savjet', test: /molb|ください|dopu|もいい|savjet|方がいい/i },
  { id: 'prenosenje', title: '🗣️ Prenošenje tuđih riječi', test: /prenoš|tuđ|という|ime nečega/i },
  { id: 'misljenje', title: '💭 Mišljenje i pretpostavka', test: /mišljen|と思う|でしょう|ようです|čini se|らしい/i },
  { id: 'usporedba', title: '⚖️ Usporedba', test: /usporedb|より|一番|いちばん/i },
  { id: 'opis', title: '🏷️ Opis imenice', test: /opisuje imenicu|ispred imenice/i },
  { id: 'svrha', title: '🎯 Svrha', test: /svrh/i },
  { id: 'uzrok', title: '❓ Uzrok i razlog', test: /uzrok|razlog|ので|から（|ため/i },
  { id: 'promjena', title: '🔄 Promjena stanja', test: /promjen|postati|になる|くなる/i },
  { id: 'uvjet', title: '🔀 Uvjet', test: /uvjet|[～〜]たら|[～〜]ば/i },
  { id: 'vrijeme', title: '⏱️ Vrijeme i redoslijed', test: /vrijeme:|kad|nakon|prije|とき|てから|前に|ながら|istovremeno/i },
  { id: 'zelja', title: '💫 Želja i pokušaj', test: /želj|probati|てみる|たい/i },
  { id: 'mogucnost', title: '💪 Mogućnost', test: /ことができる|mogućnost|teškoć|にくい|やすい/i },
  { id: 'trajanje', title: '▶️ Radnja u tijeku i stanje', test: /trajn|u tijeku|ている|ていました/i },
  { id: 'davanje', title: '🎁 Davanje i primanje', test: /くれる|あげる|もらう|za mene/i },
  { id: 'pasiv', title: '🔁 Pasiv', test: /pasiv/i },
  { id: 'ostalo', title: '📎 Ostali oblici riječi', test: /./ },
]

// Ključ konstrukcije: oblik ～xxx iz naziva ("razlog: ～ので" i "uzrok: ～ので" su isto), inače naziv.
export function constructionKey(label: string): string {
  const m = label.match(/[～〜][^\s,:;()（）]+/)
  return m ? m[0].replace('〜', '～') : label.replace(/\s*\(.*\)$/, '').trim()
}

export function categoryOf(label: string, formula = ''): string {
  return CATEGORIES.find((c) => c.test.test(`${label} ${formula}`))!.id
}

// Sve konstrukcije iz priča, po grupama; unutar grupe od najčešće.
export function constructionsByCategory(stories: Story[]): Map<string, Construction[]> {
  const byKey = new Map<string, Construction & { category: string }>()
  for (const story of stories) {
    story.sentences.forEach((sentence, index) => {
      sentence.chunk_info?.forEach((ci, chunk) => {
        if (!ci.grammar_hr) return
        const key = constructionKey(ci.grammar_hr)
        let c = byKey.get(key)
        if (!c) {
          c = { key, label: ci.grammar_hr, formula: ci.formula, rule: ci.rule_hr, examples: [], category: categoryOf(ci.grammar_hr, ci.formula) }
          byKey.set(key, c)
        }
        c.examples.push({ storyId: story.id, index, sentence, chunk })
      })
    })
  }
  const out = new Map<string, Construction[]>()
  for (const cat of CATEGORIES) {
    const list = [...byKey.values()].filter((c) => c.category === cat.id).sort((a, b) => b.examples.length - a.examples.length)
    if (list.length) out.set(cat.id, list)
  }
  return out
}

// --- Oblici riječi ---

// Za svaki oblik: riječi iz priča koje su baš u tom obliku (行きました → uljudni prošli od 行く).
export function formExamples(stories: Story[], words: ConjWord[]): Map<string, (Example & { lemma: ConjWord })[]> {
  const byLemma = new Map<string, ConjWord[]>()
  for (const w of words) byLemma.set(w.word, [...(byLemma.get(w.word) ?? []), w])
  const out = new Map<string, (Example & { lemma: ConjWord })[]>()
  for (const story of stories) {
    story.sentences.forEach((sentence, index) => {
      sentence.words.forEach((word, wi) => {
        for (const lemma of byLemma.get(word.lemma) ?? []) {
          for (const f of FORMS) {
            let r
            try {
              r = conjugate(lemma, f.id)
            } catch {
              continue
            }
            if (f.kind === (lemma.class === 'na-pridjev' ? 'na-pridjev' : lemma.class === 'i-pridjev' || lemma.class === 'ii' ? 'i-pridjev' : 'glagol') && r.written === word.text) {
              out.set(f.id, [...(out.get(f.id) ?? []), { storyId: story.id, index, sentence, word: wi, lemma }])
            }
          }
        }
      })
    })
  }
  return out
}
