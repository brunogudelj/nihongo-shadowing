// Testovi pravila odlučivanja vodiča (dorada 1V). Pokretanje: npm test
import { describe, expect, it } from 'vitest'
import type { ConjAttempt, MyWord, SentenceState } from './db'
import { VODIC } from './vodic-config'
import { addDays, initialState } from './vodic-plan'
import {
  afterStoryTest,
  afterThird,
  afterWordReview,
  konjugatorAdvance,
  nextMonday,
  nextTopic,
  unlearnedLeft,
  weeklyReport,
  wordsForReview,
} from './vodic-rules'

const MON = '2026-10-05'
const word = (i: number): MyWord => ({ id: `w${i}|r${i}`, word: `w${i}`, reading: `r${i}`, hr: '', source: 'rijeci', addedAt: i })

describe('ponavljanje riječi', () => {
  it('zadnjih 25 dodanih, pa 10 starijih, bez ponavljanja', () => {
    const words = Array.from({ length: 50 }, (_, i) => word(i))
    const list = wordsForReview(words, [], MON, () => 0)
    expect(list).toHaveLength(35)
    expect(list[0].id).toBe('w49|r49') // najnovija prva
    expect(new Set(list.map((w) => w.id)).size).toBe(35)
  })

  it('2 "Nisam" zaredom: riječ sutra ide na početak', () => {
    let r = afterWordReview(undefined, 'w1|r1', false, MON)
    expect(r.priorityOn).toBeUndefined()
    r = afterWordReview(r, 'w1|r1', false, MON)
    expect(r.priorityOn).toBe(addDays(MON, 1))
    const words = Array.from({ length: 40 }, (_, i) => word(i))
    expect(wordsForReview(words, [r], addDays(MON, 1), () => 0)[0].id).toBe('w1|r1')
    expect(afterWordReview(r, 'w1|r1', true, MON).nisamStreak).toBe(0)
  })
})

describe('konjugator: novi red', () => {
  let t = 1_000
  const ans = (session: string, ok: number, form = 'te'): ConjAttempt[] =>
    Array.from({ length: 10 }, (_, i) => ({
      id: `${session}-${i}`,
      v: 1,
      at: t++,
      word: 'x',
      reading: 'x',
      wordClass: 'godan',
      form,
      point: `${form}|godan-く`,
      rule: '',
      direction: 'proizvodnja',
      source: 'vodic',
      session,
      result: i < ok ? 'znao' : 'nisam',
    }))

  it('dvije sesije zaredom s 9/10 → idući red', () => {
    const s = initialState()
    expect(konjugatorAdvance(s, [...ans('a', 9)]).konjRow).toBe(s.konjRow)
    expect(konjugatorAdvance(s, [...ans('a', 9), ...ans('b', 10)]).konjRow).toBe(s.konjRow + 1)
  })

  it('jedna slaba sesija između: ostaje', () => {
    const s = initialState()
    expect(konjugatorAdvance(s, [...ans('a', 10), ...ans('b', 7)]).konjRow).toBe(s.konjRow)
  })

  it('slobodno vježbanje i vodič vrijede jednako', () => {
    const s = initialState()
    const free = ans('c', 10).map((a) => ({ ...a, source: 'slobodno' as const }))
    expect(konjugatorAdvance(s, [...free, ...ans('d', 10)]).konjRow).toBe(s.konjRow + 1)
  })
})

describe('treća rečenica', () => {
  it('3 dana zaredom ne prođe D iz prve → 7 dana samo 2 dnevno', () => {
    let s = initialState()
    s = afterThird(s, false, MON)
    s = afterThird(s, false, addDays(MON, 1))
    expect(s.thirdBackoffUntil).toBeUndefined()
    s = afterThird(s, false, addDays(MON, 2))
    expect(s.thirdBackoffUntil).toBe(addDays(MON, 2 + VODIC.third.backoffDays))
    expect(afterThird({ ...s, thirdFailStreak: 2 }, true, MON).thirdFailStreak).toBe(0)
  })
})

describe('subota: test priče', () => {
  const done = (i: number): SentenceState => ({ id: `kyushu-001:${i}`, storyId: 'kyushu-001', index: i, status: 'gotova', updatedAt: 0 })
  const all = Array.from({ length: 7 }, (_, i) => done(i))
  const SAT = addDays(MON, 5)

  it('najviše 2 neuspjele → priča gotova, sljedeća u ponedjeljak', () => {
    const r = afterStoryTest(initialState(), 'kyushu-001', [1, 4], all, SAT)
    expect(r.passed).toBe(true)
    expect(r.state.storyIndex).toBe(1)
    expect(r.state.storyStartedOn).toBe(nextMonday(SAT))
    expect(r.sentences.map((s) => s.status)).toEqual(['u-radu', 'u-radu'])
  })

  it('više od 2 → priča ostaje, neuspjele idu na doradu', () => {
    const r = afterStoryTest(initialState(), 'kyushu-001', [0, 2, 5], all, SAT)
    expect(r.passed).toBe(false)
    expect(r.state.storyIndex).toBe(0)
    expect(r.sentences).toHaveLength(3)
  })
})

describe('narudžba priče', () => {
  it('kad ostane manje od 10 neučenih rečenica u redu', () => {
    const stories = VODIC.storyOrder.map((id) => ({ id, sentenceCount: 8 }))
    expect(unlearnedLeft(initialState(), stories, [])).toBe(24)
    expect(unlearnedLeft({ ...initialState(), storyIndex: 2 }, stories, [])).toBe(8)
    expect(nextTopic(3)?.tema).toBe(VODIC.storyTopics[0].tema)
  })
})

describe('tjedni izvještaj', () => {
  it('kraći od 25 redaka i razumljiv', () => {
    const text = weeklyReport({
      date: addDays(MON, 6),
      state: initialState(),
      storyTitle: () => '九州旅行',
      sentenceText: () => '夏休みに九州へ行きました。',
      sentences: [{ id: 'kyushu-001:0', storyId: 'kyushu-001', index: 0, status: 'gotova', updatedAt: 0, doneOn: MON, fails: 2 }],
      days: [{ date: MON, v: 1, short: true, steps: [], done: ['rijeci'], readingSec: 95 }],
      attempts: [],
      myWordsCount: 12,
      reviews: [],
    })
    const lines = text.split('\n')
    expect(lines.length).toBeLessThan(25)
    expect(text).toContain('tjedan 1')
    expect(text).toContain('九州旅行')
    expect(text).toContain('夏休みに九州へ行きました。')
    expect(text).toContain('Skraćeni plan: 1×')
    expect(text).toContain('1:35')
  })
})
