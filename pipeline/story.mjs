// Piše novu kratku priču za zadanu temu preko Claude API-ja.
// Pokretanje: npm run story -- <tema>     (npr. npm run story -- japanske-zeljeznice)
// Ključ se čita iz okoline (ANTHROPIC_API_KEY u GitHub Codespaces Secrets ili .env).
// Svako pokretanje radi NOVU priču (001, 002, ...) i nikad ne prepisuje postojeću.
// Nova priča se odmah provjeri (fond). Ako je ispod cilja, Claude je jednom prepravi.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { parse } from 'yaml'
import { checkFond, fondRecord, printFond, TARGET } from './fond.mjs'

const MODEL = 'claude-opus-5-5'
// Cijena po milijunu tokena (USD), za ispis troška.
const PRICE_IN = 4
const PRICE_OUT = 20

const ROLES = [
  'vrijeme', 'mjesto', 'subjekt', 'objekt', 'glagol', 'pridjev', 'prilog',
  'imenica', 'cestica', 'kopula', 'veznik', 'interpunkcija', 'ostalo',
]

// Oblik odgovora koji Claude mora vratiti (strukturirani izlaz).
const SCHEMA = {
  type: 'object',
  properties: {
    title_ja: { type: 'string' },
    title_hr: { type: 'string' },
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ja: { type: 'string' },
          hr: { type: 'string' },
          chunks: { type: 'array', items: { type: 'string' } },
          words: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                lemma: { type: 'string' },
                reading: { type: 'string' },
                role: { type: 'string', enum: ROLES },
                explanation_hr: { type: 'string' },
              },
              required: ['text', 'lemma', 'reading', 'role', 'explanation_hr'],
              additionalProperties: false,
            },
          },
        },
        required: ['ja', 'hr', 'chunks', 'words'],
        additionalProperties: false,
      },
    },
  },
  required: ['title_ja', 'title_hr', 'sentences'],
  additionalProperties: false,
}

const SYSTEM = `You write short Japanese stories for a Croatian learner who practises shadowing (listening and repeating aloud).

Language limits:
- Vocabulary: JLPT N5 and N4 only. Grammar: up to JLPT N3.
- Exceptions: the proper names and the extra vocabulary listed in the theme may be used freely.
- Natural, everyday spoken Japanese in polite form (です/ます), first person.

Story:
- 5 to 8 sentences that form one coherent little story with a beginning and an end.
- Each sentence short enough to shadow comfortably (about 10 to 30 characters).

For every sentence give:
- "ja": the sentence in normal Japanese writing (kanji where a native would use them).
- "hr": a natural Croatian translation.
- "chunks": the sentence split into bunsetsu-like pieces for shadowing piece by piece. Joined together they must reproduce "ja" exactly, punctuation included (attach punctuation to the preceding chunk).
- "words": the sentence split into words and particles. Joined together the "text" values must reproduce "ja" exactly. Keep polite endings attached to their word (行きます is one word). Punctuation is its own word with role "interpunkcija".
  - "lemma": dictionary form (行きます → 行く).
  - "reading": reading of "text" in hiragana (katakana words: repeat them as they are).
  - "role": the word's role in this sentence.
  - "explanation_hr": one short Croatian sentence explaining the meaning in this context and, where useful, the form (e.g. "行く (ići) + ます, uljudni oblik"). For particles explain what they mark here.

Titles: "title_ja" short Japanese title, "title_hr" its Croatian translation.`

const themeId = process.argv[2]
if (!themeId) {
  const themes = readdirSync('themes').map((f) => f.replace(/\.ya?ml$/, ''))
  console.error('Napiši temu, npr.: npm run story -- japanske-zeljeznice')
  console.error(`Teme: ${themes.join(', ')}`)
  process.exit(1)
}
const themeFile = `themes/${themeId}.yaml`
if (!existsSync(themeFile)) {
  console.error(`Nema teme ${themeFile}.`)
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Nedostaje ANTHROPIC_API_KEY. Spremi ga u GitHub Codespaces Secrets i ponovno pokreni Codespace.')
  process.exit(1)
}

const theme = parse(readFileSync(themeFile, 'utf8'))
const outDir = `content/stories/${themeId}`
mkdirSync(outDir, { recursive: true })
const next = readdirSync(outDir).filter((f) => /^\d{3}\.json$/.test(f)).length + 1
const id = String(next).padStart(3, '0')

const themeYaml = readFileSync(themeFile, 'utf8')
const client = new Anthropic()
let totalIn = 0
let totalOut = 0

// Jedan poziv Claudeu; vrati priču u zadanom obliku i model koji ju je napisao.
async function ask(content) {
  const response = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
    .finalMessage()

  totalIn += response.usage.input_tokens
  totalOut += response.usage.output_tokens
  if (response.stop_reason === 'refusal') {
    console.error('Claude je odbio zahtjev:', response.stop_details?.explanation)
    process.exit(1)
  }
  if (response.stop_reason === 'max_tokens') {
    console.error('Odgovor je prekinut (predug). Ništa nije spremljeno.')
    process.exit(1)
  }
  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  return { story: JSON.parse(text), model: response.model }
}

console.log(`Claude piše priču ${id} za temu "${theme.naziv}"... (traje 1 do 3 minute)`)
let { story, model } = await ask(`Theme (YAML):\n\n${themeYaml}`)

// Provjera fonda. Ako je ispod cilja, Claude jednom prepravi priču.
let fond = await checkFond(story, themeId)
console.log('')
printFond(fond)
if (!fond.ok) {
  const words = [...new Set(fond.outside.map((o) => o.word))].join('、')
  console.log(`\nClaude prepravlja priču da izbaci riječi izvan fonda... (jednom, oko 0,15 $)`)
  ;({ story, model } = await ask(
    `Theme (YAML):\n\n${themeYaml}\n\n` +
      `Here is a story you wrote for this theme:\n\n${JSON.stringify(story)}\n\n` +
      `These words are outside the JLPT N5/N4 vocabulary list: ${words}\n` +
      'Rewrite only the sentences that use them, replacing each with N5/N4 vocabulary or rephrasing ' +
      'so it is not needed. Keep everything else the same. Return the whole story in the same format.',
  ))
  fond = await checkFond(story, themeId)
  console.log('')
  printFond(fond)
}

// Provjera: chunkovi i riječi moraju točno složiti rečenicu.
const problems = []
story.sentences.forEach((s, i) => {
  if (s.chunks.join('') !== s.ja) problems.push(`rečenica ${i + 1}: chunkovi ne slažu rečenicu`)
  if (s.words.map((w) => w.text).join('') !== s.ja) problems.push(`rečenica ${i + 1}: riječi ne slažu rečenicu`)
})
if (!fond.ok) problems.push(`fond: pokrivenost ${fond.coverage}% je ispod ${TARGET}%`)

const cost = (totalIn * PRICE_IN + totalOut * PRICE_OUT) / 1e6

const out = `${outDir}/${id}.json`
writeFileSync(
  out,
  JSON.stringify(
    {
      id: `${themeId}-${id}`,
      theme: themeId,
      model,
      created: new Date().toISOString().slice(0, 10),
      needs_review: problems,
      fond: fondRecord(fond),
      ...story,
    },
    null,
    2,
  ) + '\n',
)

console.log(`\n${story.title_ja}  (${story.title_hr})\n`)
story.sentences.forEach((s, i) => {
  console.log(`${i + 1}. ${s.ja}`)
  console.log(`   ${s.hr}`)
  console.log(`   chunkovi: ${s.chunks.join(' | ')}`)
})
console.log(`\nSpremljeno: ${out}`)
if (model !== MODEL) console.log(`Napomena: priču je napisao rezervni model ${model}.`)
console.log(problems.length ? `Za provjeru: ${problems.join('; ')}` : 'Provjera: chunkovi, riječi i fond su ispravni.')
console.log(`Trošak: ${totalIn} + ${totalOut} tokena ≈ ${cost.toFixed(3)} $`)
