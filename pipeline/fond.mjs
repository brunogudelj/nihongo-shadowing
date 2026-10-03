// Zajednička provjera fonda riječi (JLPT N5 + N4), koriste je check.mjs i story.mjs.
// Ne broje se čestice, pomoćni glagoli i interpunkcija. Dopušteni su vlastita imena,
// dodatni rječnik iz teme i riječi iz gramatičkih uzoraka do N3 (npr. ～とき).

import { readFileSync } from 'node:fs'
import kuromoji from 'kuromoji'
import { parse } from 'yaml'

// Cilj pokrivenosti u postocima. Za besplatnu probu: FOND_CILJ=101 npm run provjera -- ...
export const TARGET = Number(process.env.FOND_CILJ ?? 95)

const SKIP_POS = new Set(['助詞', '助動詞', '記号'])

const toHiragana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

// Svi poznati oblici riječi s popisa (pismo, čitanje, drugi zapisi) i iz gramatike.
const known = new Set()
for (const v of JSON.parse(readFileSync('data/vocab-n4.json', 'utf8'))) {
  for (const form of [v.word, v.reading, ...v.other_forms]) if (form) known.add(form.replace(/^～|～$/g, ''))
}
for (const g of JSON.parse(readFileSync('data/grammar-n3.json', 'utf8'))) {
  for (const part of g.pattern.replace(/[（(].*?[）)]/g, '').split(/[/／・、]/)) {
    const form = part.replace(/[～〜\s]/g, '')
    if (form) known.add(form)
  }
}

let tokenizerPromise
function getTokenizer() {
  tokenizerPromise ??= new Promise((resolve, reject) =>
    kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, t) => (err ? reject(err) : resolve(t))),
  )
  return tokenizerPromise
}

// Vrati pokrivenost priče i popis riječi izvan fonda.
export async function checkFond(story, themeId) {
  const theme = parse(readFileSync(`themes/${themeId}.yaml`, 'utf8'))
  const allowed = new Set()
  for (const x of [...(theme.vlastita_imena ?? []), ...(theme.dodatni_rjecnik ?? [])]) {
    if (x.ja) allowed.add(x.ja)
    if (x.citanje) allowed.add(x.citanje)
  }

  const tokenizer = await getTokenizer()
  let counted = 0
  let inList = 0
  let exceptions = 0
  const outside = []

  story.sentences.forEach((s, i) => {
    for (const t of tokenizer.tokenize(s.ja)) {
      if (SKIP_POS.has(t.pos)) continue
      const lemma = t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form
      const reading = t.reading && t.reading !== '*' ? toHiragana(t.reading) : null
      counted++
      if (allowed.has(lemma) || allowed.has(t.surface_form) || t.pos_detail_1 === '固有名詞' || t.pos_detail_1 === '数') {
        exceptions++
      } else if (
        known.has(lemma) ||
        known.has(t.surface_form) ||
        (reading && known.has(reading)) ||
        // Prilog s nastavkom ～に (本当に → 本当)
        (lemma.endsWith('に') && known.has(lemma.slice(0, -1)))
      ) {
        inList++
      } else {
        outside.push({ word: lemma, sentence: i + 1 })
      }
    }
  })

  const coverage = counted ? Math.round(((inList + exceptions) / counted) * 1000) / 10 : 100
  return { counted, inList, exceptions, coverage, outside, ok: coverage >= TARGET }
}

// Kratki ispis rezultata u terminal.
export function printFond(r) {
  console.log(`Riječi u priči: ${r.counted} (s popisa ${r.inList}, imena i dodatne riječi iz teme ${r.exceptions})`)
  console.log(`Pokrivenost: ${r.coverage}% (cilj ${TARGET}%) ${r.ok ? '✓' : '✗ ispod cilja'}`)
  console.log(
    r.outside.length
      ? `Izvan popisa:\n- ${r.outside.map((o) => `${o.word} (rečenica ${o.sentence})`).join('\n- ')}`
      : 'Sve riječi su unutar fonda.',
  )
}

// Zapis za polje "fond" u priči.
export const fondRecord = (r) => ({
  pokrivenost: r.coverage,
  izvan_popisa: r.outside.map((o) => `${o.word} (rečenica ${o.sentence})`),
})
