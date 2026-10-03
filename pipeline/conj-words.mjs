// Riječi za konjugator: glagoli i pridjevi s popisa N5 + N4, s hrvatskim značenjem.
// Pokretanje: npm run konjugator-rijeci
// Hrvatska značenja piše Claude (jedan poziv, ~0,15 do 0,20 $). Riječi koje već imaju
// značenje u data/konjugator.json ne šalju se ponovno, pa ponovno pokretanje ne troši.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-5-5'
const PRICE_IN = 4
const PRICE_OUT = 20
const OUT = 'data/konjugator.json'

// Vrsta riječi s popisa (JMdict oznake) → skupina za konjugaciju.
const CLASSES = {
  v1: 'ichidan', 'v1-s': 'ichidan',
  v5u: 'godan', v5k: 'godan', v5g: 'godan', v5s: 'godan', v5t: 'godan',
  v5n: 'godan', v5b: 'godan', v5m: 'godan', v5r: 'godan',
  'v5k-s': 'iku', 'v5r-i': 'aru', vk: 'kuru', 'vs-i': 'suru', vs: 'suru-imenica',
  'adj-i': 'i-pridjev', 'adj-ix': 'ii', 'adj-na': 'na-pridjev',
}

const words = []
const seen = new Set()
for (const v of JSON.parse(readFileSync('data/vocab-n4.json', 'utf8'))) {
  const codes = v.pos.split(/;\s*/)
  const cls = codes.map((c) => CLASSES[c]).find(Boolean)
  if (!cls) continue
  let { word, reading } = v
  if (cls === 'suru-imenica') {
    word = word.replace(/する$/, '') + 'する'
    reading = reading.replace(/する$/, '') + 'する'
  }
  // Glagol mora završavati istom kanom u pismu i u čitanju (買う / かう), inače ga preskačemo.
  if (cls !== 'i-pridjev' && cls !== 'na-pridjev' && word.slice(-1) !== reading.slice(-1)) continue
  if (seen.has(word)) continue
  seen.add(word)
  words.push({ word, reading, class: cls, level: v.level, transitive: codes.includes('vt') || undefined, en: v.meanings })
}

const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : []
const known = new Map(old.map((w) => [w.word, w.hr]))
const missing = words.filter((w) => !known.get(w.word))
console.log(`Riječi za konjugator: ${words.length} (bez hrvatskog značenja: ${missing.length})`)

if (missing.length) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Nedostaje ANTHROPIC_API_KEY.')
    process.exit(1)
  }
  console.log('Claude piše hrvatska značenja... (traje 1 do 3 minute)')
  const client = new Anthropic()
  const response = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              words: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { word: { type: 'string' }, hr: { type: 'string' } },
                  required: ['word', 'hr'],
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
        'Verbs as Croatian infinitives ("jesti", "presjesti"), adjectives in masculine singular ("ukusan", "ljubazan"), ' +
        'する-verbs as a verb ("šetati" for 散歩する). If there are two common meanings, separate them with ", ". ' +
        'Return every word, with "word" exactly as given.',
      messages: [{ role: 'user', content: JSON.stringify(missing.map(({ word, reading, en }) => ({ word, reading, en }))) }],
    })
    .finalMessage()
  if (response.stop_reason !== 'end_turn') {
    console.error(`Claude nije završio (${response.stop_reason}). Ništa nije spremljeno.`)
    process.exit(1)
  }
  const result = JSON.parse(response.content.find((b) => b.type === 'text')?.text ?? '{}')
  for (const w of result.words ?? []) if (w.hr) known.set(w.word, w.hr)
  const cost = (response.usage.input_tokens * PRICE_IN + response.usage.output_tokens * PRICE_OUT) / 1e6
  console.log(`Trošak: ≈ ${cost.toFixed(3)} $`)
}

const out = words.filter((w) => known.get(w.word)).map(({ en: _en, ...w }) => ({ ...w, hr: known.get(w.word) }))
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
const byClass = Object.groupBy(out, (w) => w.class)
console.log(`Spremljeno ${out.length} riječi u ${OUT}:`)
console.log(Object.entries(byClass).map(([c, l]) => `${c} ${l.length}`).join(', '))
const noHr = words.length - out.length
if (noHr) console.log(`Bez značenja (preskočeno): ${noHr}. Pokreni ponovno da se dopune.`)
