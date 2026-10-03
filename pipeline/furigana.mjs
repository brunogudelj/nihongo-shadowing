// Dodaje furiganu u priču pomoću japanskog rječnika (Kuromoji).
// Pokretanje: npm run furigana -- <tema>/<broj>   (npr. npm run furigana -- japanske-zeljeznice/001)
// Čitanje iz teme ima prednost; inače se čitanje iz rječnika uspoređuje s Claudeovim. Ako se razlikuju, riječ ide na popis za ručnu provjeru.
// Besplatno je i smije se pokretati koliko god puta: svaki put ponovno izračuna furiganu.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import kuromoji from 'kuromoji'
import { parse } from 'yaml'

const KANJI = /[㐀-䶿一-鿿々]/

const storyArg = process.argv[2]
if (!storyArg) {
  console.error('Napiši priču, npr.: npm run furigana -- japanske-zeljeznice/001')
  process.exit(1)
}
const file = `content/stories/${storyArg}.json`
if (!existsSync(file)) {
  console.error(`Nema priče ${file}.`)
  process.exit(1)
}

// Katakana → hiragana (za usporedbu čitanja).
const toHiragana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

// Furigana samo iznad kanjija: 買いました + かいました → 買(か) いました.
function splitFurigana(text, reading) {
  if (!KANJI.test(text)) return [{ text }]
  const runs = text.match(/[㐀-䶿一-鿿々]+|[^㐀-䶿一-鿿々]+/g)
  const pattern = runs.map((r) => (KANJI.test(r) ? '(.+?)' : `(${toHiragana(r)})`)).join('')
  const match = new RegExp(`^${pattern}$`).exec(reading)
  if (!match) return null
  return runs.map((r, i) => (KANJI.test(r) ? { text: r, reading: match[i + 1] } : { text: r }))
}

const tokenizer = await new Promise((resolve, reject) =>
  kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, t) => (err ? reject(err) : resolve(t))),
)

const story = JSON.parse(readFileSync(file, 'utf8'))

// Čitanja iz teme (npr. 日本 → にほん) imaju prednost pred rječnikom.
const theme = parse(readFileSync(`themes/${story.theme}.yaml`, 'utf8'))
const themeReadings = new Map(
  [...(theme.vlastita_imena ?? []), ...(theme.dodatni_rjecnik ?? [])].filter((x) => x.citanje).map((x) => [x.ja, x.citanje]),
)
const review = []

story.sentences.forEach((sentence, si) => {
  // Čitanje iz rječnika za svaki znak rečenice, preko tokena.
  const tokens = tokenizer.tokenize(sentence.ja)
  let pos = 0
  for (const word of sentence.words) {
    const start = pos
    const end = pos + word.text.length
    pos = end

    // Tokeni koji pokrivaju ovu riječ. Ako token prelazi granicu riječi, rječnik ne pomaže.
    const covering = tokens.filter((t) => t.word_position - 1 < end && t.word_position - 1 + t.surface_form.length > start)
    const aligned = covering.every((t) => t.word_position - 1 >= start && t.word_position - 1 + t.surface_form.length <= end)
    const dictReading = aligned
      ? toHiragana(covering.map((t) => (t.reading && t.reading !== '*' ? t.reading : t.surface_form)).join(''))
      : null
    const claudeReading = toHiragana(word.reading || word.text)

    if (!KANJI.test(word.text)) {
      word.furigana = [{ text: word.text }]
      continue
    }

    // Prednost ima rječnik. Kad ga nema ili se ne slaže s Claudeom, riječ ide na provjeru.
    const fromTheme = themeReadings.get(word.text)
    const reading = fromTheme ?? dictReading ?? claudeReading
    if (fromTheme) {
      if (fromTheme !== claudeReading) review.push(`rečenica ${si + 1}: ${word.text}: tema kaže ${fromTheme}, Claude kaže ${claudeReading}`)
    } else if (dictReading && dictReading !== claudeReading) {
      review.push(`rečenica ${si + 1}: ${word.text}: rječnik kaže ${dictReading}, Claude kaže ${claudeReading}`)
    } else if (!dictReading) {
      review.push(`rečenica ${si + 1}: ${word.text}: nema u rječniku, koristim Claudeovo ${claudeReading}`)
    }

    const parts = splitFurigana(word.text, reading)
    if (parts) {
      word.furigana = parts
    } else {
      word.furigana = [{ text: word.text, reading }]
      review.push(`rečenica ${si + 1}: ${word.text}: furigana se ne da rasporediti po kanjijima`)
    }
  }
})

// Stare napomene o furigani zamijeni novima, ostale zadrži.
story.needs_review = [...(story.needs_review ?? []).filter((r) => !r.startsWith('furigana: ')), ...review.map((r) => `furigana: ${r}`)]
writeFileSync(file, JSON.stringify(story, null, 2) + '\n')

// Ispis: kanji s čitanjem u zagradi.
story.sentences.forEach((s, i) => {
  const line = s.words
    .flatMap((w) => w.furigana)
    .map((p) => (p.reading ? `${p.text}(${p.reading})` : p.text))
    .join('')
  console.log(`${i + 1}. ${line}`)
})
console.log(`\nSpremljeno: ${file}`)
console.log(review.length ? `\nZa ručnu provjeru:\n- ${review.join('\n- ')}` : '\nProvjera: rječnik i Claude se slažu za sve riječi.')
