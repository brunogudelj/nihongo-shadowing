// Doslovni prijevod i uloga za svaki blok (chunk) rečenice.
// Zajedničko za story.mjs (nove priče) i literal.mjs (dopuna postojećih).

// Uloga bloka određuje boju u aplikaciji.
export const CHUNK_ROLES = ['vrijeme', 'mjesto', 'subjekt', 'objekt', 'glagol', 'opis', 'ostalo']

export const CHUNK_INFO_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      literal_hr: { type: 'string' },
      role: { type: 'string', enum: CHUNK_ROLES },
    },
    required: ['literal_hr', 'role'],
    additionalProperties: false,
  },
}

export const CHUNK_INFO_RULES = `- "chunk_info": one entry per chunk, in the same order as "chunks".
  - "literal_hr": a literal Croatian gloss of that chunk alone, 1 to 4 words, keeping the Japanese word order of the sentence (the learner reads the glosses left to right, verb last). Render particles as Croatian prepositions or cases where natural. Examples: 夏休みに → "za ljetne praznike", 九州へ → "na Kyushu", 行きました → "otišao sam", 雨が → "kiša", 切符を → "kartu".
  - "role": the chunk's role in the sentence:
    "vrijeme" (when), "mjesto" (where, from, to, direction), "subjekt" (topic with は or subject with が),
    "objekt" (object, usually with を), "glagol" (verb or predicate, including です/でした endings),
    "opis" (adverbs and modifiers such as とても, 緑の, きれいな), "ostalo" (conjunctions and anything else).`
