// Testovi za slabe točke konjugatora (dorada 1K). Pokretanje: npm test
import { describe, expect, it } from 'vitest'
import { isWeak, pruneIds, sessions, weakPoints, weakWords } from './conjugator-stats'
import type { ConjAttempt } from './db'

let t = 0
const attempt = (result: 'znao' | 'nisam', o: Partial<ConjAttempt> = {}): ConjAttempt => ({
  id: `a${++t}`,
  v: 1,
  at: t,
  word: '書く',
  reading: 'かく',
  wordClass: 'godan',
  form: 'te',
  point: 'te|godan-く',
  rule: 'godan ～く → ～いて',
  direction: 'proizvodnja',
  source: 'slobodno',
  session: 's1',
  result,
  ...o,
})
const many = (n: number, result: 'znao' | 'nisam', o: Partial<ConjAttempt> = {}) =>
  Array.from({ length: n }, () => attempt(result, o))

describe('slabe točke', () => {
  it('20 pogrešnih na ～く → ～いて: točka je slaba i na popisu', () => {
    const xs = many(20, 'nisam')
    expect(isWeak(xs)).toBe(true)
    const list = weakPoints(xs)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ point: 'te|godan-く', rule: 'godan ～く → ～いて', example: '書く', recentFails: 20 })
  })

  it('nakon toga 10 točnih zaredom: nestane s popisa', () => {
    const xs = [...many(20, 'nisam'), ...many(10, 'znao')]
    expect(weakPoints(xs)).toHaveLength(0)
    // i ne vraća se odmah idućim točnim odgovorom
    expect(weakPoints([...xs, attempt('znao')])).toHaveLength(0)
  })

  it('9 točnih od 10 je dovoljno za izlaz, 8 nije', () => {
    expect(isWeak([...many(20, 'nisam'), ...many(4, 'znao'), attempt('nisam'), ...many(5, 'znao')])).toBe(false)
    expect(isWeak([...many(20, 'nisam'), ...many(4, 'znao'), ...many(2, 'nisam'), ...many(4, 'znao')])).toBe(true)
  })

  it('manje od 5 pokušaja nije slaba točka, ni uz sve pogrešne', () => {
    expect(isWeak(many(4, 'nisam'))).toBe(false)
    expect(isWeak(many(5, 'nisam'))).toBe(true)
  })

  it('30 % pogrešnih u zadnjih 20 je granica', () => {
    expect(isWeak([...many(14, 'znao'), ...many(6, 'nisam')])).toBe(true) // 6/20 = 30 %
    expect(isWeak([...many(15, 'znao'), ...many(5, 'nisam')])).toBe(false) // 5/20 = 25 %
  })

  it('pokušaji iz vodiča i iz slobodnog vježbanja vrijede jednako', () => {
    const mixed = [...many(10, 'nisam', { source: 'vodic' }), ...many(10, 'nisam', { source: 'slobodno' })]
    const free = many(20, 'nisam')
    expect(weakPoints(mixed)[0].recentFails).toBe(weakPoints(free)[0].recentFails)
  })

  it('različita pravila su različite točke', () => {
    const xs = [...many(6, 'nisam'), ...many(6, 'znao', { point: 'te|iku', rule: 'iznimka 行く → 行って' })]
    expect(weakPoints(xs).map((p) => p.point)).toEqual(['te|godan-く'])
  })
})

describe('slabe riječi', () => {
  it('riječ je slaba ako je pala 2 od zadnja 3 puta', () => {
    expect(weakWords([attempt('znao'), attempt('nisam'), attempt('nisam')])).toHaveLength(1)
    expect(weakWords([attempt('nisam'), attempt('znao'), attempt('nisam')])).toHaveLength(1)
    expect(weakWords([attempt('nisam'), attempt('nisam'), attempt('znao'), attempt('znao')])).toHaveLength(0)
  })
})

describe('sesije', () => {
  it('sesija broji tek od 10 odgovora i prolazi s 9/10', () => {
    const xs = [...many(9, 'znao', { session: 'a' }), attempt('nisam', { session: 'a' }), ...many(9, 'znao', { session: 'b' })]
    const s = sessions(xs)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ session: 'a', answers: 10, known: 9, passed: true })
  })

  it('vodič i slobodno vježbanje u istoj sesiji vrijede jednako', () => {
    const xs = [...many(5, 'znao', { session: 'c', source: 'vodic' }), ...many(5, 'znao', { session: 'c', source: 'slobodno' })]
    expect(sessions(xs)[0]).toMatchObject({ answers: 10, passed: true })
  })

  it('može se brojati samo za zadane oblike', () => {
    const xs = [...many(10, 'znao', { session: 'd', form: 'te' }), ...many(10, 'nisam', { session: 'd', form: 'ta' })]
    expect(sessions(xs, ['te'])[0]).toMatchObject({ answers: 10, passed: true })
    expect(sessions(xs)[0]).toMatchObject({ answers: 20, passed: false })
  })
})

describe('čišćenje starih zapisa', () => {
  it('ispod granice ne briše ništa', () => {
    expect(pruneIds(many(100, 'znao'))).toEqual([])
  })
})
