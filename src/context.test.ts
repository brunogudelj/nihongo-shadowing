// Testovi za rečenice za kontekst kod "Pokaži". Pokretanje: npm test
import { describe, expect, it } from 'vitest'
import { contextKey, pickContext, sentencesWith } from './context'
import { stories } from './stories'

describe('rečenice za kontekst', () => {
  it('nalazi rečenicu po osnovnom obliku, i kad je riječ konjugirana', () => {
    const found = sentencesWith('行く')
    expect(found.length).toBeGreaterThan(0)
    for (const c of found) {
      expect(c.words.length).toBeGreaterThan(0)
      for (const i of c.words) expect(c.sentence.words[i].lemma).toBe('行く')
    }
    // Barem jedan oblik nije sam 行く (npr. 行きました).
    expect(found.some((c) => c.words.some((i) => c.sentence.words[i].text !== '行く'))).toBe(true)
  })

  it('riječ koje nema u pričama nema rečenicu', () => {
    expect(sentencesWith('存在しない')).toEqual([])
    expect(pickContext('存在しない')).toBeNull()
  })

  it('ne ponavlja prošlu rečenicu ako postoji druga', () => {
    const all = sentencesWith('行く')
    expect(all.length).toBeGreaterThan(1)
    const last = contextKey(all[0])
    for (const r of [0, 0.3, 0.6, 0.99]) expect(contextKey(pickContext('行く', last, stories, () => r)!)).not.toBe(last)
  })

  it('jedina rečenica se smije ponoviti', () => {
    const story = stories[0]
    const one = [{ ...story, sentences: [story.sentences[0]] }]
    const lemma = story.sentences[0].words[0].lemma
    const first = pickContext(lemma, undefined, one)!
    expect(pickContext(lemma, contextKey(first), one)).not.toBeNull()
  })
})
