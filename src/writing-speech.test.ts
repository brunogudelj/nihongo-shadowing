import { describe, expect, it } from 'vitest'
import plan from '../data/pisanje-plan.json'
import { hasSound, letterGroups, parts, sayable, speechTexts } from './writing-speech'

describe('plan pisanja: rastavljanje i izgovor', () => {
  it('rastavi redove slova, kombinacije i parove', () => {
    expect(letterGroups('あいうえお きゃ ぬ/め')).toEqual([['あ', 'い', 'う', 'え', 'お'], ['きゃ'], ['ぬ', 'め']])
  })
  it('dijelovi riječi i tekst bez razmaka', () => {
    expect(parts('はし / ほし')).toEqual(['はし', 'ほし'])
    expect(sayable('まいあさ コーヒーを のみます。')).toBe('まいあさコーヒーをのみます。')
  })
  it('znakovi bez izgovora se ne izgovaraju', () => {
    for (const s of ['っ', 'ー', 'ゃ', '゛']) expect(hasSound(s)).toBe(false)
    for (const s of ['あ', 'きゃ', 'ティ', 'たべた']) expect(hasSound(s)).toBe(true)
  })
  it('svi tekstovi za izgovor su kana, bez razmaka i kosih crta', () => {
    const t = [...speechTexts(plan)]
    expect(t.length).toBeGreaterThan(500)
    for (const s of t) expect(s).toMatch(/^[ぁ-ゖァ-ヺー。]+$/)
  })
  it('svaki red oblika ima onoliko oblika koliko i stupaca', () => {
    for (const d of plan.dani) for (const r of d.oblici?.redovi ?? []) expect(r.oblici.length).toBe(d.oblici!.stupci.length)
  })
})
