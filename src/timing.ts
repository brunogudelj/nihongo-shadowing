// Vremena chunkova i riječi, iz vremena riječi koja je spremio pipeline (Azure).
import type { Sentence } from './stories'

export type ChunkSpan = { from: number; to: number; startMs: number; endMs: number }

// Za svaki chunk: koje riječi sadrži [from, to) i kad počinje i završava u mp3 rečenice.
// Riječ pripada chunku u kojem počinje.
export function chunkSpans(sentence: Sentence): ChunkSpan[] {
  const wordStarts: number[] = []
  let pos = 0
  for (const w of sentence.words) {
    wordStarts.push(pos)
    pos += w.text.length
  }
  let chunkStart = 0
  let wi = 0
  return sentence.chunks.map((chunk) => {
    const chunkEnd = chunkStart + chunk.length
    const from = wi
    while (wi < wordStarts.length && wordStarts[wi] < chunkEnd) wi++
    chunkStart = chunkEnd
    const to = Math.max(wi, from + 1)
    return { from, to, startMs: sentence.words[from].start_ms, endMs: sentence.words[to - 1].end_ms }
  })
}

// Riječ koja se izgovara u trenutku ms (u mp3 rečenice), ili -1.
export function wordAt(sentence: Sentence, ms: number): number {
  const words = sentence.words
  if (!words.length || ms < words[0].start_ms || ms > words[words.length - 1].end_ms) return -1
  return words.findLastIndex((w) => w.start_ms <= ms)
}

// Isto, ali za mp3 cijele priče. Vremena riječi postoje samo za mp3 rečenice,
// pa se položaj unutar rečenice preračuna razmjerno (dovoljno točno za isticanje).
export function wordAtInFull(sentence: Sentence, ms: number): number {
  const words = sentence.words
  if (!words.length) return -1
  const share = (ms - sentence.full_start_ms) / Math.max(1, sentence.full_end_ms - sentence.full_start_ms)
  const first = words[0].start_ms
  const last = words[words.length - 1].end_ms
  return wordAt(sentence, first + share * (last - first))
}
