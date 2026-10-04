// Hrvatsko značenje svakog oblika u konjugatoru (npr. 食べませんでした → "nisam jeo (uljudno)").
// Pokretanje: npm run konjugator-znacenja
// Oblike računa src/conjugate.ts; Claude piše samo njihova značenja, u grupama po 40 riječi.
// Riječi koje već imaju značenja u data/konjugator-oblici.json ne šalju se ponovno.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { conjugate, FORMS, kindOf } from '../src/conjugate.ts'

const MODEL = 'claude-opus-5-5'
const PRICE_IN = 4
const PRICE_OUT = 20
const OUT = 'data/konjugator-oblici.json'
const BATCH = 40

const words = JSON.parse(readFileSync('data/konjugator.json', 'utf8'))
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const formsOf = (w) => FORMS.filter((f) => f.kind === kindOf(w))
const missing = words.filter((w) => formsOf(w).some((f) => !done[w.word]?.[f.id]))
console.log(`Riječi: ${words.length}, bez značenja oblika: ${missing.length}`)

const SYSTEM = `You write short Croatian meanings of conjugated Japanese words for a learner.
For each word you get its Croatian meaning and a list of forms (id, Japanese form, form name).
Give each form a natural Croatian equivalent, 1 to 5 words:
- Verbs in the first person: masu "jedem", masen "ne jedem", mashita "jeo sam", masendeshita "nisam jeo",
  ta "jeo sam", nai "ne jedem", nakatta "nisam jeo", te "jedem i…", tai "želim jesti",
  potential "mogu jesti", volitional "jedimo! / jest ću", ba "ako jedem",
  passive "biti pojeden / netko mi pojede", causative "natjerati (pustiti) nekoga da jede".
  Past tense in the masculine ("jeo sam"). Add "(uljudno)" for masu, masen, mashita, masendeshita.
- i-adjectives as a statement: i-desu "skupo je", i-nai "nije skupo", i-ta "bilo je skupo",
  i-nakatta "nije bilo skupo", i-te "skupo i…", i-adv "skupo (prilog)", i-ba "ako je skupo".
- na-adjectives: na-desu "tiho je", na-nai "nije tiho", na-ta "bilo je tiho", na-nakatta "nije bilo tiho",
  na-te "tiho i…", na-adv "tiho (prilog)", na-noun "tih (+ imenica)".
Return every word and every form, with "word" and "id" exactly as given.`

const SCHEMA = {
  type: 'object',
  properties: {
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          forms: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string', enum: FORMS.map((f) => f.id) }, hr: { type: 'string' } },
              required: ['id', 'hr'],
              additionalProperties: false,
            },
          },
        },
        required: ['word', 'forms'],
        additionalProperties: false,
      },
    },
  },
  required: ['words'],
  additionalProperties: false,
}

let cost = 0
if (missing.length) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Nedostaje ANTHROPIC_API_KEY.')
    process.exit(1)
  }
  const client = new Anthropic()
  for (let i = 0; i < missing.length; i += BATCH) {
    const part = missing.slice(i, i + BATCH)
    console.log(`Claude piše značenja oblika za riječi ${i + 1}–${i + part.length} od ${missing.length}...`)
    const input = part.map((w) => ({
      word: w.word,
      reading: w.reading,
      hr: w.hr,
      forms: formsOf(w).map((f) => ({ id: f.id, ja: conjugate(w, f.id).written, form: f.label })),
    }))
    const response = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(input) }],
      })
      .finalMessage()
    cost += (response.usage.input_tokens * PRICE_IN + response.usage.output_tokens * PRICE_OUT) / 1e6
    if (response.stop_reason !== 'end_turn') {
      console.error(`Claude nije završio (${response.stop_reason}). Spremam ono što je gotovo; pokreni ponovno.`)
      break
    }
    const result = JSON.parse(response.content.find((b) => b.type === 'text')?.text ?? '{}')
    for (const w of result.words ?? []) {
      done[w.word] ??= {}
      for (const f of w.forms) if (f.hr) done[w.word][f.id] = f.hr
    }
    // Sprema nakon svake grupe, da prekid ne izgubi plaćeni posao.
    writeFileSync(OUT, JSON.stringify(done, null, 1) + '\n')
  }
}

writeFileSync(OUT, JSON.stringify(done, null, 1) + '\n')
const left = words.filter((w) => formsOf(w).some((f) => !done[w.word]?.[f.id])).length
console.log(`Spremljeno u ${OUT}.${left ? ` Bez svih značenja još: ${left} riječi (pokreni ponovno).` : ''}`)
if (cost) console.log(`Trošak: ≈ ${cost.toFixed(3)} $`)
