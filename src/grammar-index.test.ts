// Kazalo gramatike iz priča. Pokretanje: npm test
import { expect, it } from 'vitest'
import words from '../data/konjugator.json'
import type { ConjWord } from './conjugate'
import { categoryOf, constructionKey, constructionsByCategory, formExamples } from './grammar-index'
import { stories } from './stories'

it('ključ i grupa konstrukcije', () => {
  expect(constructionKey('razlog: ～ので')).toBe('～ので')
  expect(constructionKey('uzrok: ～ので')).toBe('～ので')
  expect(categoryOf('mišljenje: ～と思う')).toBe('misljenje')
  expect(categoryOf('savjet: ～た方がいい')).toBe('molba')
  expect(categoryOf('mogućnost: ～でしょう')).toBe('misljenje')
  expect(categoryOf('glagol opisuje imenicu')).toBe('opis')
  expect(categoryOf('promjena stanja: ～になる')).toBe('promjena')
  expect(categoryOf('svrha: ～ため')).toBe('svrha')
  expect(categoryOf('uzrok: ～ため')).toBe('uzrok')
  expect(categoryOf('nakon toga: ～てから')).toBe('vrijeme')
})

it('konstrukcije i oblici iz stvarnih priča', () => {
  const byCat = constructionsByCategory(stories)
  expect(byCat.get('uzrok')?.find((c) => c.key === '～ので')?.examples.length).toBeGreaterThan(1)
  const forms = formExamples(stories, words as ConjWord[])
  expect(forms.get('mashita')?.length).toBeGreaterThan(5)
  expect(forms.get('te')?.some((e) => e.sentence.words[e.word!].text === '持って')).toBe(true)
})

it('たら unutar riječi (働いて) nije uvjet', () => {
  expect(categoryOf('trajna radnja: ～ている (prošlo)', '働く (はたらく) → 働いていました')).toBe('trajanje')
  expect(categoryOf('uvjet: ～たら')).toBe('uvjet')
})
