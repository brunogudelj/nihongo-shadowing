// Preuzima popise riječi (N5 + N4), gramatike (N5 do N3) i kanjija (N5 do N1) iz OpenJLPT-a
// i sprema ih u data/. Pokreće se jednom (ili kad želimo novu verziju popisa).
// Pokretanje: npm run popisi

import { mkdirSync, writeFileSync } from 'node:fs'

// Točna verzija OpenJLPT-a, da popisi budu uvijek isti.
const COMMIT = '0d1d3410bec90bd4098a7c72de820543cb4f707c'
const BASE = `https://raw.githubusercontent.com/evanclan/OpenJLPT/${COMMIT}/data/csv`

// Jednostavan CSV čitač (navodnici, zarezi i novi redovi unutar navodnika).
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted && c === '"' && text[i + 1] === '"') {
      field += '"'
      i++
    } else if (c === '"') {
      quoted = !quoted
    } else if (quoted) {
      field += c
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...data] = rows
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

async function load(name) {
  const res = await fetch(`${BASE}/${name}.csv`)
  if (!res.ok) throw new Error(`Ne mogu preuzeti ${name}.csv (${res.status})`)
  return parseCsv(await res.text())
}

const vocab = []
for (const level of ['n5', 'n4']) {
  for (const r of await load(`vocab-${level}`)) {
    vocab.push({
      word: r.word,
      reading: r.reading,
      other_forms: r.other_forms ? r.other_forms.split(/[;；、,]\s*/).filter(Boolean) : [],
      level: r.level,
      pos: r.pos,
      meanings: r.meanings,
    })
  }
}

const grammar = []
for (const level of ['n5', 'n4', 'n3']) {
  for (const r of await load(`grammar-${level}`)) {
    grammar.push({ id: r.id, pattern: r.pattern, level: r.level, meaning: r.meaning, formation: r.formation })
  }
}

// Kanji: svi JLPT razine, da svaki kanji iz priča i riječi ima podatke (čitanja i značenje iz KANJIDIC2).
const split = (v) => (v ? v.split(/;\s*/).filter(Boolean) : [])
const kanji = {}
for (const level of ['n5', 'n4', 'n3', 'n2', 'n1']) {
  for (const r of await load(`kanji-${level}`)) {
    kanji[r.character] = { level: r.level, on: split(r.onyomi), kun: split(r.kunyomi), meanings: r.meanings }
  }
}

mkdirSync('data', { recursive: true })
writeFileSync('data/vocab-n4.json', JSON.stringify(vocab, null, 1) + '\n')
writeFileSync('data/grammar-n3.json', JSON.stringify(grammar, null, 1) + '\n')
writeFileSync('data/kanji.json', JSON.stringify(kanji) + '\n')

const count = (list, level) => list.filter((x) => x.level === level).length
console.log(`Riječi: ${vocab.length} (N5 ${count(vocab, 'N5')}, N4 ${count(vocab, 'N4')}) → data/vocab-n4.json`)
console.log(`Kanji: ${Object.keys(kanji).length} → data/kanji.json`)
console.log(
  `Gramatika: ${grammar.length} (N5 ${count(grammar, 'N5')}, N4 ${count(grammar, 'N4')}, N3 ${count(grammar, 'N3')}) → data/grammar-n3.json`,
)
