// Dopunjuje postojeću priču doslovnim prijevodom i ulogom svakog bloka (chunka), preko Claudea.
// Pokretanje: npm run doslovno -- <tema>/<broj>   (npr. npm run doslovno -- kyushu/001)
// Šalje samo rečenice i blokove, ne cijelu priču, pa je jeftino (~0,02 do 0,04 $).
// Ako priča to već ima, ne radi ništa i ne troši.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { CHUNK_INFO_RULES, CHUNK_INFO_SCHEMA } from './chunk-info.mjs'

const MODEL = 'claude-opus-5-5'
const PRICE_IN = 4
const PRICE_OUT = 20

const storyArg = process.argv[2]
if (!storyArg) {
  console.error('Napiši priču, npr.: npm run doslovno -- kyushu/001')
  process.exit(1)
}
const file = `content/stories/${storyArg}.json`
if (!existsSync(file)) {
  console.error(`Nema priče ${file}.`)
  process.exit(1)
}
const story = JSON.parse(readFileSync(file, 'utf8'))
if (story.sentences.every((s) => s.chunk_info?.length === s.chunks.length)) {
  console.log('Priča već ima doslovni prijevod. Preskačem (ništa nije potrošeno).')
  process.exit(0)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Nedostaje ANTHROPIC_API_KEY.')
  process.exit(1)
}

const SCHEMA = {
  type: 'object',
  properties: {
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: { chunk_info: CHUNK_INFO_SCHEMA },
        required: ['chunk_info'],
        additionalProperties: false,
      },
    },
  },
  required: ['sentences'],
  additionalProperties: false,
}

const SYSTEM = `You help a Croatian learner of Japanese read sentences block by block.
For each sentence you get the Japanese text, a natural Croatian translation and its chunks.
Return one entry per sentence, in the same order, with:
${CHUNK_INFO_RULES}`

const input = story.sentences.map((s) => ({ ja: s.ja, hr: s.hr, chunks: s.chunks }))

console.log(`Claude piše doslovni prijevod za "${story.title_ja}"...`)
const client = new Anthropic()
const response = await client.beta.messages
  .stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  })
  .finalMessage()

if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
  console.error(`Claude nije završio (${response.stop_reason}). Ništa nije spremljeno.`)
  process.exit(1)
}
const result = JSON.parse(response.content.find((b) => b.type === 'text')?.text ?? '{}')

// Svaka rečenica mora dobiti točno onoliko unosa koliko ima blokova.
const bad = story.sentences.findIndex((s, i) => result.sentences?.[i]?.chunk_info?.length !== s.chunks.length)
if (result.sentences?.length !== story.sentences.length || bad >= 0) {
  console.error(`Odgovor se ne slaže s blokovima (rečenica ${bad + 1}). Ništa nije spremljeno; pokušaj ponovno.`)
  process.exit(1)
}

story.sentences.forEach((s, i) => (s.chunk_info = result.sentences[i].chunk_info))
const cost = (response.usage.input_tokens * PRICE_IN + response.usage.output_tokens * PRICE_OUT) / 1e6
story.trosak_usd = Math.round(((story.trosak_usd ?? 0) + cost) * 1000) / 1000
writeFileSync(file, JSON.stringify(story, null, 2) + '\n')

story.sentences.forEach((s, i) => {
  console.log(`${i + 1}. ${s.chunks.map((c, k) => `${c} [${s.chunk_info[k].literal_hr} · ${s.chunk_info[k].role}]`).join('  ')}`)
})
console.log(`\nSpremljeno: ${file}`)
console.log(`Trošak: ≈ ${cost.toFixed(3)} $`)
