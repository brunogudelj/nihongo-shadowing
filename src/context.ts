// Rečenice za kontekst kod "Pokaži": rečenice iz priča u kojima se riječ pojavljuje
// (po osnovnom obliku, pa za 行く vrijede i 行きます i 行った).
import { stories, type Sentence, type Story } from './stories'

export type ContextSentence = { storyId: string; index: number; sentence: Sentence; words: number[] }

export function sentencesWith(lemma: string, list: Story[] = stories): ContextSentence[] {
  return list.flatMap((story) =>
    story.sentences.flatMap((sentence, index) => {
      const words = sentence.words.flatMap((w, i) => (w.lemma === lemma ? [i] : []))
      return words.length ? [{ storyId: story.id, index, sentence, words }] : []
    }),
  )
}

// Nasumična rečenica; ako ih ima više, ne ona koja je bila prošli put.
export function pickContext(lemma: string, last?: string, list: Story[] = stories, random = Math.random): ContextSentence | null {
  const all = sentencesWith(lemma, list)
  const others = all.filter((c) => contextKey(c) !== last)
  const pool = others.length ? others : all
  return pool.length ? pool[Math.floor(random() * pool.length)] : null
}

export const contextKey = (c: ContextSentence) => `${c.storyId}:${c.index}`
