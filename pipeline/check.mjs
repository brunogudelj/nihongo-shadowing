// Provjerava je li priča unutar fonda riječi (JLPT N5 + N4).
// Pokretanje: npm run provjera -- <tema>/<broj>   (npr. npm run provjera -- japanske-zeljeznice/001)
// Riječi iz gramatike do N3 su dopuštene. Ne broje se čestice, pomoćni glagoli i interpunkcija. Vlastita imena i dodatni
// rječnik iz teme su dopušteni. Cilj je najmanje 95% pokrivenosti.
// Rezultat se upisuje u priču (polje "fond"). Besplatno je.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import kuromoji from 'kuromoji'
import { parse } from 'yaml'

const TARGET = 95
const SKIP_POS = new Set(['助詞', '助動詞', '記号'])

const storyArg = process.argv[2]
if (!storyArg) {
  console.error('Napiši priču, npr.: npm run provjera -- japanske-zeljeznice/001')
  process.exit(1)
}
const file = `content/stories/${storyArg}.json`
if (!existsSync(file)) {
  console.error(`Nema priče ${file}.`)
  process.exit(1)
}

const toHiragana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

// Svi poznati oblici riječi s popisa (pismo, čitanje, drugi zapisi).
const known = new Set()
for (const v of JSON.parse(readFileSync('data/vocab-n4.json', 'utf8'))) {
  for (const form of [v.word, v.reading, ...v.other_forms]) if (form) known.add(form.replace(/^～|～$/g, ''))
}

// Riječi iz gramatičkih uzoraka do N3 (npr. ～とき, ～ことがある) su također dopuštene.
for (const g of JSON.parse(readFileSync('data/grammar-n3.json', 'utf8'))) {
  for (const part of g.pattern.replace(/[（(].*?[）)]/g, '').split(/[/／・、]/)) {
    const form = part.replace(/[～〜\s]/g, '')
    if (form) known.add(form)
  }
}

const story = JSON.parse(readFileSync(file, 'utf8'))
const theme = parse(readFileSync(`themes/${story.theme}.yaml`, 'utf8'))
const allowed = new Set()
for (const x of [...(theme.vlastita_imena ?? []), ...(theme.dodatni_rjecnik ?? [])]) {
  if (x.ja) allowed.add(x.ja)
  if (x.citanje) allowed.add(x.citanje)
}

const tokenizer = await new Promise((resolve, reject) =>
  kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, t) => (err ? reject(err) : resolve(t))),
)

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
    } else if (known.has(lemma) || known.has(t.surface_form) || (reading && known.has(reading))) {
      inList++
    } else {
      outside.push(`${lemma} (rečenica ${i + 1})`)
    }
  }
})

const coverage = counted ? Math.round(((inList + exceptions) / counted) * 1000) / 10 : 100
story.fond = { pokrivenost: coverage, izvan_popisa: outside }
writeFileSync(file, JSON.stringify(story, null, 2) + '\n')

console.log(`Riječi u priči: ${counted} (s popisa ${inList}, imena i dodatne riječi iz teme ${exceptions})`)
console.log(`Pokrivenost: ${coverage}% (cilj ${TARGET}%) ${coverage >= TARGET ? '✓' : '✗ ispod cilja'}`)
console.log(outside.length ? `Izvan popisa:\n- ${outside.join('\n- ')}` : 'Sve riječi su unutar fonda.')
