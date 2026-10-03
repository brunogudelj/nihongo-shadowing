// Doslovni prijevod i uloga za svaki blok (chunk) rečenice.
// Zajedničko za story.mjs (nove priče) i literal.mjs (dopuna postojećih).

// Uloga bloka određuje boju u aplikaciji.
export const CHUNK_ROLES = ['vrijeme', 'mjesto', 'subjekt', 'objekt', 'glagol', 'opis', 'ostalo']

// Gramatička formula bloka: naziv, formula s čitanjem, kako nastaje, što znači ovdje.
export const FORMULA_PROPS = {
  grammar_hr: { type: 'string' },
  formula: { type: 'string' },
  rule_hr: { type: 'string' },
  formula_hr: { type: 'string' },
}

export const CHUNK_INFO_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      literal_hr: { type: 'string' },
      role: { type: 'string', enum: CHUNK_ROLES },
      ...FORMULA_PROPS,
    },
    required: ['literal_hr', 'role', ...Object.keys(FORMULA_PROPS)],
    additionalProperties: false,
  },
}

// Formula: samo za blok sa zanimljivom gramatikom; inače prazno.
export const FORMULA_RULES = `  - Grammar note, only when the chunk shows a grammar point worth noticing for an N4 learner
    (te-form, past or plain form describing a noun, ～たい, ～ている, ～てくれる, ～に行く, ～とき, adverb from an adjective,
    past or negative of an adjective, potential, etc.). Otherwise all four fields are "" (plain noun + particle chunks
    like 地図を get ""; a plain polite ～ました verb gets "" unless something else is notable).
    The learner reads kana slowly and knows little kanji, so always give readings. All Croatian text is simple, no jargon
    beyond the common form names (te-oblik, i-pridjev, na-pridjev, uljudni oblik, obični oblik).
    - "grammar_hr": short Croatian name of the grammar point, e.g. "te-oblik glagola", "glagol opisuje imenicu",
      "prošlo vrijeme i-pridjeva", "želja: ～たい", "trajna radnja: ～ている", "netko učini nešto za mene: ～てくれる".
    - "formula": dictionary form → used form, each with hiragana reading and romaji in brackets,
      e.g. "持つ (もつ, motsu) → 持って (もって, motte)", "買う (かう, kau) → 買った (かった, katta) + imenica".
    - "rule_hr": how the form is built, one short sentence, e.g. "Glagoli koji završavaju na -つ: つ → って.",
      "i-pridjev: zadnji い → かった.", "Obični prošli oblik glagola stoji ispred imenice i opisuje je."
    - "formula_hr": what it means in this sentence, one or two short Croatian sentences, e.g.
      "Veže dvije radnje: uzeo sam kartu i (s njom) tražio trgovinu."`

export const CHUNK_INFO_RULES = `- "chunk_info": one entry per chunk, in the same order as "chunks".
  - "literal_hr": a literal Croatian gloss of that chunk alone, 1 to 4 words, keeping the Japanese word order of the sentence (the learner reads the glosses left to right, verb last). Render particles as Croatian prepositions or cases where natural. Examples: 夏休みに → "za ljetne praznike", 九州へ → "na Kyushu", 行きました → "otišao sam", 雨が → "kiša", 切符を → "kartu".
  - "role": the chunk's role in the sentence:
    "vrijeme" (when), "mjesto" (where, from, to, direction), "subjekt" (topic with は or subject with が),
    "objekt" (object, usually with を), "glagol" (verb or predicate, including です/でした endings),
    "opis" (adverbs and modifiers such as とても, 緑の, きれいな), "ostalo" (conjunctions and anything else).
${FORMULA_RULES}`
