// Popis riječi za aplikaciju: sve riječi N5 + N4 s hrvatskim značenjem → data/rijeci.json.
// Pokretanje: npm run rijeci
// Značenja iz konjugatora se preuzimaju; ostala piše Claude (u grupama po 200).
// Riječi koje već imaju značenje u data/rijeci.json ne šalju se ponovno, pa ponovno pokretanje ne troši.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-5-5'
const PRICE_IN = 4
const PRICE_OUT = 20
const OUT = 'data/rijeci.json'
const BATCH = 200

const key = (word, reading) => `${word.replace(/する$/, '')}|${reading.replace(/する$/, '')}`

const vocab = JSON.parse(readFileSync('data/vocab-n4.json', 'utf8'))
const known = new Map()
for (const w of JSON.parse(readFileSync('data/konjugator.json', 'utf8'))) known.set(key(w.word, w.reading), w.hr)
if (existsSync(OUT)) for (const w of JSON.parse(readFileSync(OUT, 'utf8'))) if (w.hr) known.set(key(w.word, w.reading), w.hr)

const missing = vocab.filter((w) => !known.get(key(w.word, w.reading)))
console.log(`Riječi: ${vocab.length}, bez hrvatskog značenja: ${missing.length}`)

let cost = 0
if (missing.length) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Nedostaje ANTHROPIC_API_KEY.')
    process.exit(1)
  }
  const client = new Anthropic()
  for (let i = 0; i < missing.length; i += BATCH) {
    const part = missing.slice(i, i + BATCH)
    console.log(`Claude piše značenja ${i + 1}–${i + part.length} od ${missing.length}...`)
    const response = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                words: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { word: { type: 'string' }, reading: { type: 'string' }, hr: { type: 'string' } },
                    required: ['word', 'reading', 'hr'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['words'],
              additionalProperties: false,
            },
          },
        },
        system:
          'Translate Japanese dictionary words into short Croatian meanings for a learner (1 to 4 words). ' +
          'Verbs as Croatian infinitives ("jesti"), adjectives in masculine singular ("ukusan"), nouns in nominative. ' +
          'If there are two common meanings, separate them with ", ". Return every word, with "word" and "reading" exactly as given.',
        messages: [
          { role: 'user', content: JSON.stringify(part.map(({ word, reading, pos, meanings }) => ({ word, reading, pos, en: meanings }))) },
        ],
      })
      .finalMessage()
    if (response.stop_reason !== 'end_turn') {
      console.error(`Claude nije završio (${response.stop_reason}). Spremam ono što je gotovo.`)
      break
    }
    const result = JSON.parse(response.content.find((b) => b.type === 'text')?.text ?? '{}')
    for (const w of result.words ?? []) if (w.hr) known.set(key(w.word, w.reading), w.hr)
    cost += (response.usage.input_tokens * PRICE_IN + response.usage.output_tokens * PRICE_OUT) / 1e6
  }
}

const out = vocab.map((w) => ({ word: w.word, reading: w.reading, level: w.level, pos: w.pos, hr: known.get(key(w.word, w.reading)) ?? '' }))
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
const noHr = out.filter((w) => !w.hr).length
console.log(`Spremljeno ${out.length} riječi u ${OUT}${noHr ? ` (bez značenja: ${noHr}, pokreni ponovno)` : ''}.`)
if (cost) console.log(`Trošak: ≈ ${cost.toFixed(3)} $`)
