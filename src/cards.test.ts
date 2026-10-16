// @vitest-environment happy-dom
// Testovi za FSRS kartice i prijenos starog napretka. Pokretanje: npm test
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, applyBackup, buildBackup, parseBackup } from './backup'
import { cardId, dayStart, dueCards, newLeftToday, rateCard, saveRating, seedCards, syncCards } from './cards'
import { db, type CardLog, type MyWord, type SentenceState } from './db'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const NOW = new Date(2026, 9, 16, 10, 0).getTime() // 16. 10. 2026. u 10:00 (lokalno)

const word = (w: string, r: string): MyWord => ({ id: `${w}|${r}`, word: w, reading: r, hr: '', source: 'rijeci', addedAt: 1 })
const sentence = (i: number, status: SentenceState['status'], extra: Partial<SentenceState> = {}): SentenceState => ({
  id: `kyushu-001:${i}`,
  storyId: 'kyushu-001',
  index: i,
  status,
  updatedAt: 1,
  ...extra,
})
const seed = (over: Partial<Parameters<typeof seedCards>[0]>) =>
  seedCards({ sentences: [], myWords: [], wordReviews: [], wordAttempts: [], existing: new Set(), now: NOW, ...over })

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.clear()
})

describe('ocjena Znao / Nisam', () => {
  it('nova kartica: Znao → opet za 1 h, Nisam → za 10 min', () => {
    const znao = rateCard(undefined, 'rijec', '駅|えき', true, NOW)
    expect(znao.card.due - NOW).toBe(HOUR)
    expect(znao.log.wasNew).toBe(true)
    const nisam = rateCard(undefined, 'rijec', '駅|えき', false, NOW)
    expect(nisam.card.due - NOW).toBe(10 * MIN)
  })

  it('nakon dva Znao kartica prelazi na dane', () => {
    const a = rateCard(undefined, 'fraza', 'kyushu-001:0', true, NOW).card
    const b = rateCard(a, 'fraza', 'kyushu-001:0', true, a.due)
    expect(b.card.due - a.due).toBeGreaterThanOrEqual(DAY)
    expect(b.log.wasNew).toBe(false)
  })

  it('zaboravljena kartica (Nisam) vraća se za 10 min', () => {
    const known = seed({ sentences: [sentence(0, 'gotova', { intervalIdx: 2, due: '2026-10-16' })] })[0]
    const { card } = rateCard(known, 'fraza', known.ref, false, NOW)
    expect(card.due - NOW).toBe(10 * MIN)
    expect(card.lapses).toBe(1)
  })
})

describe('dnevno ograničenje novih', () => {
  const log = (kind: 'rijec' | 'fraza', at: number, wasNew = true): CardLog => ({
    id: `${kind}${at}`,
    v: 1,
    cardId: 'x',
    kind,
    at,
    ok: true,
    wasNew,
  })

  it('broji samo danas uvedene kartice te vrste', () => {
    const logs = [log('fraza', NOW - HOUR), log('fraza', NOW - 2 * HOUR), log('fraza', NOW - DAY), log('fraza', NOW, false), log('rijec', NOW)]
    expect(newLeftToday(logs, 'fraza', NOW)).toBe(1) // 3 dnevno, 2 danas uvedene
    expect(newLeftToday(logs, 'rijec', NOW)).toBe(9)
  })

  it('nikad ispod nule, a sutra se puni ispočetka', () => {
    const logs = [1, 2, 3, 4].map((i) => log('fraza', dayStart(NOW) + i * MIN))
    expect(newLeftToday(logs, 'fraza', NOW)).toBe(0)
    expect(newLeftToday(logs, 'fraza', NOW + DAY)).toBe(3)
  })
})

describe('kartice na redu', () => {
  it('samo one kojima je rok prošao, od najstarije', () => {
    const a = rateCard(undefined, 'rijec', 'a|a', false, NOW).card // za 10 min
    const b = rateCard(undefined, 'rijec', 'b|b', false, NOW - HOUR).card // kasni 50 min
    const c = rateCard(undefined, 'fraza', 'x:0', false, NOW - HOUR).card // druga vrsta
    expect(dueCards([a, b, c], 'rijec', NOW).map((x) => x.ref)).toEqual(['b|b'])
    expect(dueCards([a, b, c], 'rijec', NOW + HOUR).map((x) => x.ref)).toEqual(['b|b', 'a|a'])
  })
})

describe('prijenos starog napretka', () => {
  it('gotova rečenica zadržava rok, u radu je na redu odmah, nova nema karticu', () => {
    const cards = seed({
      sentences: [sentence(0, 'gotova', { intervalIdx: 2, due: '2026-10-20' }), sentence(1, 'u-radu'), sentence(2, 'nova')],
    })
    expect(cards.map((c) => c.id)).toEqual(['fraza:kyushu-001:0', 'fraza:kyushu-001:1'])
    const [done, inWork] = cards
    expect(done.state).toBe(2) // ponavljanje
    expect(done.stability).toBe(7) // treći korak rasporeda 1, 3, 7…
    expect(done.due).toBe(new Date(2026, 9, 20).getTime())
    expect(inWork.state).toBe(1) // učenje
    expect(inWork.due).toBe(NOW)
    expect(cards.every((c) => c.seeded)).toBe(true)
  })

  it('riječ: zadnji odgovor odlučuje, a riječ koju nisi ponavljao ostaje nova', () => {
    const cards = seed({
      myWords: [word('駅', 'えき'), word('山', 'やま'), word('川', 'かわ')],
      wordReviews: [{ id: '山|やま', v: 1, nisamStreak: 0, nisamTotal: 1, lastOn: '2026-10-14' }],
      wordAttempts: [
        { id: '1', v: 1, at: NOW - 2 * DAY, word: '駅', reading: 'えき', direction: 'jp-hr', source: 'slobodno', session: 's', result: 'znao' },
        { id: '2', v: 1, at: NOW - DAY, word: '駅', reading: 'えき', direction: 'jp-hr', source: 'slobodno', session: 's', result: 'nisam' },
      ],
    })
    const byRef = new Map(cards.map((c) => [c.ref, c]))
    expect(byRef.get('駅|えき')?.state).toBe(1) // zadnji put Nisam → učenje
    expect(byRef.get('山|やま')?.state).toBe(2) // zadnji put znao → zna se
    expect(byRef.has('川|かわ')).toBe(false)
  })

  it('postojeće kartice ne dira', () => {
    const cards = seed({ sentences: [sentence(0, 'gotova')], existing: new Set([cardId('fraza', 'kyushu-001:0')]) })
    expect(cards).toEqual([])
  })

  it('syncCards je siguran za ponavljanje', async () => {
    await db.sentences.bulkPut([sentence(0, 'gotova', { due: '2026-10-17' }), sentence(1, 'u-radu')])
    expect(await syncCards(NOW)).toBe(2)
    expect(await syncCards(NOW)).toBe(0)
    expect(await db.cards.count()).toBe(2)
  })
})

describe('baza i sigurnosna kopija', () => {
  it('saveRating sprema karticu i zapis ocjene', async () => {
    await saveRating('rijec', '駅|えき', true, 'sesija-1', NOW)
    await saveRating('rijec', '駅|えき', false, 'sesija-1', NOW + HOUR)
    const card = await db.cards.get('rijec:駅|えき')
    expect(card?.reps).toBe(2)
    const logs = await db.cardLogs.toArray()
    expect(logs.map((l) => [l.ok, l.wasNew])).toEqual([
      [true, true],
      [false, false],
    ])
  })

  it('kartice su u izvozu i vraćaju se uvozom', async () => {
    await saveRating('fraza', 'kyushu-001:0', true, undefined, NOW)
    const text = JSON.stringify(await buildBackup())
    await Promise.all(db.tables.map((t) => t.clear()))
    await applyBackup(parseBackup(text), 'zamijeni')
    const card = await db.cards.get('fraza:kyushu-001:0')
    expect(card?.due).toBe(NOW + HOUR)
    expect(await db.cardLogs.count()).toBe(1)
  })

  it('stara kopija (verzija 2, bez kartica) dobiva kartice iz statusa rečenica', async () => {
    const v2 = { app: APP, formatVersion: 2, exportedAt: '', tables: { sentences: [sentence(0, 'gotova', { due: '2026-10-17' })] }, settings: {} }
    await applyBackup(parseBackup(JSON.stringify(v2)), 'zamijeni')
    expect((await db.cards.toArray()).map((c) => c.id)).toEqual(['fraza:kyushu-001:0'])
  })
})
