// Osnove glagola na zaslonu Oblici. Pokretanje: npm test
import { expect, it } from 'vitest'
import words from '../data/konjugator.json'
import type { ConjWord } from './conjugate'
import { BASES, stemOf } from './stems'

const w = (word: string) => (words as ConjWord[]).find((x) => x.word === word)!
const stems = (word: string) => BASES.filter((b) => b.id !== 'te').map((b) => stemOf(w(word), b).written)

it('osnove a / i / u / e / o', () => {
  expect(stems('行く')).toEqual(['行か', '行き', '行く', '行け', '行こ'])
  expect(stems('飲む')).toEqual(['飲ま', '飲み', '飲む', '飲め', '飲も'])
  expect(stems('食べる')).toEqual(['食べ', '食べ', '食べる', '食べれ', '食べ'])
  expect(stems('する')).toEqual(['し', 'し', 'する', 'すれ', 'し'])
})
