// Testovi planera vodiča (dorada 1V): simulirani tjedan i pravila odlučivanja. Pokretanje: npm test
import { describe, expect, it } from 'vitest'
import { rateCard } from './cards'
import type { CardLog, CardRow, DayLog, SentenceState, SessionLog } from './db'
import { SESIJA, VODIC, type BlockId } from './vodic-config'
import {
  addDays,
  afterCleanTest,
  afterDFailedTwice,
  afterDPassed,
  afterWarmup,
  dayOfWeek,
  initialState,
  planDay,
  formatMinutes,
  planSession,
  sessionStats,
  type PlanInput,
  type SessionInput,
} from './vodic-plan'

const MON = '2026-10-05'
const stories = [
  { id: 'kyushu-001', sentenceCount: 7 },
  { id: 'putovanje-po-japanu-001', sentenceCount: 8 },
  { id: 'japanske-zeljeznice-001', sentenceCount: 8 },
]
const input = (o: Partial<PlanInput> = {}): PlanInput => ({
  date: MON,
  state: initialState(),
  sentences: [],
  days: [],
  stories,
  ...o,
})
const trainedOn = (...dates: string[]): DayLog[] => dates.map((date) => ({ date, v: 1, short: false, steps: [], done: ['rijeci'] }))
const ids = (refs: { storyId: string; index: number }[]) => refs.map((r) => `${r.storyId}:${r.index}`)

describe('datumi', () => {
  it('5. 10. 2026. je ponedjeljak, 11. 10. nedjelja', () => {
    expect(dayOfWeek(MON)).toBe(1)
    expect(dayOfWeek(addDays(MON, 6))).toBe(7)
  })
})

describe('obični dan', () => {
  it('ponedjeljak: 7 koraka, 75 min, prve 2 rečenice prve priče, konjugator od ～て s rječima iz priča', () => {
    const p = planDay(input())
    expect(p.kind).toBe('radni')
    expect(p.steps.map((s) => s.id)).toEqual(['rijeci', 'zagrijavanje', 'nove', 'cisto', 'konjugator', 'nove-rijeci', 'citanje'])
    expect(p.totalMinutes).toBe(75)
    expect(ids(p.newSentences)).toEqual(['kyushu-001:0', 'kyushu-001:1'])
    expect(p.konj.forms).toContain('te')
    expect(p.konj.source).toBe('price')
  })

  it('prije početka pokazuje plan za ponedjeljak', () => {
    const p = planDay(input({ date: '2026-10-04' }))
    expect(p.kind).toBe('prije-pocetka')
    expect(p.date).toBe(MON)
    expect(p.totalMinutes).toBe(75)
  })

  it('"Imam samo 20 min": 3 koraka, 20 min, bez konjugatora i riječi', () => {
    const p = planDay(input({ short: true }))
    expect(p.steps.map((s) => s.id)).toEqual(['rijeci', 'zagrijavanje', 'dorada'])
    expect(p.totalMinutes).toBe(20)
  })

  it('izmjena konfiguracije mijenja ponašanje bez izmjene koda', () => {
    const p = planDay(input({ config: { ...VODIC, newPerDay: 3 } }))
    expect(p.newSentences).toHaveLength(3)
  })
})

describe('simulirani tjedan', () => {
  it('pon–ned: nove rečenice redom, Čisto test sutradan, ponavljanje po rasporedu', () => {
    let sentences: SentenceState[] = []
    const days: DayLog[] = []
    const put = (s: SentenceState) => (sentences = [...sentences.filter((x) => x.id !== s.id), s])
    const get = (i: number) => sentences.find((s) => s.id === `kyushu-001:${i}`)

    // Pon: 0 i 1 prođu fazu D.
    let p = planDay(input({ date: MON, sentences, days }))
    for (const r of p.newSentences) put(afterDPassed(get(r.index), r, MON))
    days.push(...trainedOn(MON))

    // Uto: Čisto test za 0 i 1, nove 2 i 3.
    const TUE = addDays(MON, 1)
    p = planDay(input({ date: TUE, sentences, days }))
    expect(ids(p.cleanTest)).toEqual(['kyushu-001:0', 'kyushu-001:1'])
    expect(ids(p.newSentences)).toEqual(['kyushu-001:2', 'kyushu-001:3'])
    put(afterCleanTest(get(0)!, true, TUE)) // 0 gotova
    put(afterCleanTest(get(1)!, false, TUE)) // 1 pala: opet faza D
    for (const r of p.newSentences) put(afterDPassed(get(r.index), r, TUE))
    days.push(...trainedOn(TUE))

    // Sri: 0 ima rok (zagrijavanje), 1 je dorada, 2 i 3 Čisto test, nove 4 i 5.
    const WED = addDays(MON, 2)
    p = planDay(input({ date: WED, sentences, days }))
    expect(ids(p.warmup)).toEqual(['kyushu-001:0'])
    expect(ids(p.rework)).toEqual(['kyushu-001:1'])
    expect(ids(p.cleanTest)).toEqual(['kyushu-001:2', 'kyushu-001:3'])
    expect(ids(p.newSentences)).toEqual(['kyushu-001:4', 'kyushu-001:5'])
    put(afterWarmup(get(0)!, true, WED)) // idući rok za 3 dana
    expect(get(0)!.due).toBe(addDays(WED, 3))

    // Sub: test priče umjesto novih rečenica.
    const SAT = addDays(MON, 5)
    p = planDay(input({ date: SAT, sentences, days: trainedOn(MON, TUE, WED, addDays(MON, 3), addDays(MON, 4)) }))
    expect(p.kind).toBe('subota')
    expect(p.steps.map((s) => s.id)).toContain('test-price')
    expect(p.steps.map((s) => s.id)).not.toContain('nove')

    // Ned: samo ponavljanje, konjugator 15 min.
    const SUN = addDays(MON, 6)
    p = planDay(input({ date: SUN, sentences, days: trainedOn(SAT) }))
    expect(p.kind).toBe('nedjelja')
    expect(p.steps.find((s) => s.id === 'konjugator')?.minutes).toBe(15)
    expect(p.steps.map((s) => s.id)).not.toContain('nove')
    expect(p.newSentences).toEqual([])
  })

  it('rečenica koja dvaput padne fazu D sutra je prva i jedina nova', () => {
    const s = afterDFailedTwice(undefined, { storyId: 'kyushu-001', index: 0 })
    const p = planDay(input({ date: addDays(MON, 1), sentences: [s], days: trainedOn(MON) }))
    expect(ids(p.newSentences)).toEqual(['kyushu-001:0'])
  })

  it('kad nema više novih rečenica, korak 3 postaje dorada', () => {
    const all = Array.from({ length: 7 }, (_, i) => afterDPassed(undefined, { storyId: 'kyushu-001', index: i }, MON))
    const p = planDay(input({ date: addDays(MON, 3), sentences: all, days: trainedOn(addDays(MON, 2)) }))
    expect(p.steps.map((s) => s.id)).toContain('dorada')
    expect(p.newSentences).toEqual([])
  })
})

describe('propušteni dani', () => {
  it('1–2 propuštena dana: trening je normalan', () => {
    const p = planDay(input({ date: addDays(MON, 3), days: trainedOn(MON) })) // propušteno 2 dana
    expect(p.missedDays).toBe(2)
    expect(p.kind).toBe('radni')
    expect(p.newSentences.length).toBe(2)
  })

  it('3 i više: prvi dan samo ponavljanje, bez novih rečenica i riječi', () => {
    const p = planDay(input({ date: addDays(MON, 4), days: trainedOn(MON) })) // propušteno 3 dana
    expect(p.missedDays).toBe(3)
    expect(p.kind).toBe('povratak')
    expect(p.newSentences).toEqual([])
    expect(p.steps.map((s) => s.id)).not.toContain('nove-rijeci')
    // drugi dan je opet normalan
    const next = planDay(input({ date: addDays(MON, 5), days: trainedOn(MON, addDays(MON, 4)) }))
    expect(next.kind).not.toBe('povratak')
  })
})

describe('raspored ponavljanja', () => {
  it('1, 3, 7, 14, 30, pa svakih 30 dana; neuspjeh vraća na 1', () => {
    let s = afterCleanTest(afterDPassed(undefined, { storyId: 'kyushu-001', index: 0 }, MON), true, MON)
    expect(s.due).toBe(addDays(MON, 1))
    const gaps: number[] = []
    let d = s.due!
    for (let i = 0; i < 5; i++) {
      s = afterWarmup(s, true, d)
      gaps.push((Date.parse(s.due!) - Date.parse(d)) / 86_400_000)
      d = s.due!
    }
    expect(gaps).toEqual([3, 7, 14, 30, 30])
    s = afterWarmup(s, false, d)
    expect(s.due).toBe(addDays(d, 1))
    expect(s.intervalIdx).toBe(0)
  })
})

describe('konjugator', () => {
  it('prva 3 dana priče riječi iz priča, zatim svih 495', () => {
    expect(planDay(input({ date: addDays(MON, 2) })).konj.source).toBe('price')
    expect(planDay(input({ date: addDays(MON, 3) })).konj.source).toBe('sve')
  })
})

describe('kratka sesija', () => {
  const NOW = new Date(2026, 9, 16, 10, 0).getTime()
  const HOUR = 3_600_000
  // Kartica kojoj je rok prošao prije sat vremena (ocijenjena Nisam prije 70 min).
  const due = (kind: 'rijec' | 'fraza', ref: string): CardRow => rateCard(undefined, kind, ref, false, NOW - 70 * 60_000).card
  // Kartica kojoj rok još nije došao.
  const later = (kind: 'rijec' | 'fraza', ref: string): CardRow => rateCard(undefined, kind, ref, true, NOW).card
  const newLog = (kind: 'rijec' | 'fraza', i: number): CardLog => ({ id: `${kind}${i}`, v: 1, cardId: 'x', kind, at: NOW - i * 60_000, ok: true, wasNew: true })
  const session = (o: Partial<SessionInput> = {}) =>
    planSession({ minutes: 15, now: NOW, cards: [], logs: [], stories, newWordCandidates: 0, vocabLeft: 100, ...o })
  const ids = (s: { blocks: { id: BlockId }[] }) => s.blocks.map((b) => b.id)
  const total = (s: { blocks: { minutes: number }[] }) => s.blocks.reduce((n, b) => n + b.minutes, 0)
  // Niz "nasumičnih" brojeva, za ponovljive testove.
  const seq = (...xs: number[]) => {
    let i = 0
    return () => xs[i++ % xs.length]
  }

  it('zbroj blokova je uvijek točno izabrano trajanje, bez ponavljanja bloka', () => {
    const cards = [due('rijec', 'a|a'), due('fraza', 'kyushu-001:0')]
    for (const minutes of SESIJA.durations) {
      for (let k = 0; k < 50; k++) {
        const s = session({ minutes, cards, newWordCandidates: 3 })
        expect(total(s)).toBe(minutes)
        expect(new Set(ids(s)).size).toBe(s.blocks.length)
      }
    }
  })

  it('5 min je uvijek jedan kratki blok; dugi blokovi (10 min) ne ulaze', () => {
    for (let k = 0; k < 30; k++) {
      const s = session({ minutes: 5, cards: [later('fraza', 'kyushu-001:0')] })
      expect(s.blocks).toHaveLength(1)
      expect(['nova-recenica', 'prica']).not.toContain(s.blocks[0].id)
    }
  })

  it('10 min može biti jedan dugi blok ili dva kratka', () => {
    const cards = [later('fraza', 'kyushu-001:0')]
    const shapes = new Set(Array.from({ length: 200 }, () => session({ minutes: 10, cards }).blocks.length))
    expect(shapes).toEqual(new Set([1, 2]))
  })

  it('prazan blok se ne nudi', () => {
    // Nema kartica, nema tvojih riječi bez kartice, popis riječi potrošen.
    for (let k = 0; k < 50; k++) {
      const s = session({ vocabLeft: 0 })
      expect(ids(s)).not.toContain('rijeci')
      expect(ids(s)).not.toContain('fraze')
      expect(ids(s)).not.toContain('prica') // priča još nije započeta
      expect(ids(s)).not.toContain('nove-rijeci')
    }
  })

  it('kad su potrošene 3 nove rečenice danas, nema bloka Nova rečenica', () => {
    const logs = [1, 2, 3].map((i) => newLog('fraza', i))
    for (let k = 0; k < 50; k++) expect(ids(session({ logs }))).not.toContain('nova-recenica')
    // Sutra opet ima.
    const tomorrow = Array.from({ length: 100 }, () => ids(session({ logs, now: NOW + 24 * HOUR }))).flat()
    expect(tomorrow).toContain('nova-recenica')
  })

  it('riječi: nove se nude samo dok ima kvote', () => {
    const logs = Array.from({ length: 10 }, (_, i) => newLog('rijec', i))
    for (let k = 0; k < 50; k++) expect(ids(session({ newWordCandidates: 5, logs }))).not.toContain('rijeci')
  })

  it('zaostatak: više od 20 riječi ili 5 fraza na redu → blok sigurno ulazi', () => {
    const words = Array.from({ length: 21 }, (_, i) => due('rijec', `w${i}|w`))
    const fraze = Array.from({ length: 6 }, (_, i) => due('fraza', `kyushu-001:${i}`))
    for (let k = 0; k < 50; k++) {
      const s = session({ cards: [...words, ...fraze] })
      expect(ids(s)).toEqual(expect.arrayContaining(['rijeci', 'fraze']))
    }
    // U 5 minuta stane samo jedan: prvo riječi.
    expect(ids(session({ minutes: 5, cards: [...words, ...fraze] }))).toEqual(['rijeci'])
  })

  it('tekuća priča i sljedeća nova rečenica: prva rečenica bez kartice', () => {
    const cards = [0, 1, 2, 3, 4, 5, 6].map((i) => later('fraza', `kyushu-001:${i}`))
    const s = session({ cards })
    expect(s.storyId).toBe('putovanje-po-japanu-001')
    expect(s.newSentence).toEqual({ storyId: 'putovanje-po-japanu-001', index: 0 })
    expect(session({ cards: cards.slice(0, 3) }).newSentence).toEqual({ storyId: 'kyushu-001', index: 3 })
  })

  it('izbor i redoslijed ovise o slučaju (svaka sesija drugačija)', () => {
    const cards = [due('rijec', 'a|a'), due('fraza', 'kyushu-001:0')]
    const a = session({ cards, random: seq(0) })
    const b = session({ cards, random: seq(0.99) })
    expect(ids(a)).not.toEqual(ids(b))
    const seen = new Set(Array.from({ length: 200 }, () => ids(session({ cards })).join(',')))
    expect(seen.size).toBeGreaterThan(10)
  })
})

describe('brojač sesija', () => {
  const NOW = new Date(2026, 9, 16, 18, 0).getTime()
  const MIN = 60_000
  const log = (startedAt: number, minutes?: number): SessionLog => ({
    id: String(startedAt),
    v: 1,
    startedAt,
    endedAt: minutes === undefined ? undefined : startedAt + minutes * MIN,
    minutes: 15,
    blocks: [],
    storyId: 'kyushu-001',
  })

  it('broji samo završene, danas i ukupno, sa stvarnim minutama', () => {
    const logs = [
      log(NOW - 8 * 60 * MIN, 17), // danas ujutro, potrajala 17 min
      log(NOW - 2 * 60 * MIN, 5.4), // danas, 5 min i 24 s
      log(NOW - 60 * MIN), // prekinuta: ne broji se
      log(NOW - 24 * 60 * MIN, 10), // jučer
    ]
    expect(sessionStats(logs, NOW)).toEqual({ todayCount: 2, todayMinutes: 22, totalCount: 3, totalMinutes: 32 })
    expect(sessionStats([], NOW)).toEqual({ todayCount: 0, todayMinutes: 0, totalCount: 0, totalMinutes: 0 })
  })

  it('minute u satima', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(560)).toBe('9 h 20 min')
  })
})
