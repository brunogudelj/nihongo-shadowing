// Slike uz riječi: svaka slika pripada riječi s popisa. Pokretanje: npm test
import { expect, it } from 'vitest'
import emoji from '../data/emoji.json'
import words from '../data/rijeci.json'
import { emojiFor } from './emoji'

it('svaka slika pripada riječi s popisa', () => {
  const keys = new Set((words as { word: string; reading: string }[]).map((w) => `${w.word}|${w.reading}`))
  expect(Object.keys(emoji).filter((k) => !keys.has(k))).toEqual([])
})

it('more ima sliku, apstraktna riječ nema', () => {
  expect(emojiFor('海', 'うみ')).toBe('🌊')
  expect(emojiFor('もっとも', 'もっとも')).toBeUndefined()
})
