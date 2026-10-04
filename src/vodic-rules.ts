// Pravila odlučivanja vodiča (dorada 1V) koja nisu dio samog plana dana: ponavljanje riječi,
// prelazak na novi red konjugatora, treća rečenica, test priče, narudžba priče, tjedni izvještaj.
// Čiste funkcije, testirane u vodic-rules.test.ts.
import { sessions, weakPoints, weakWords } from './conjugator-stats'
import type { ConjAttempt, DayLog, MyWord, SentenceState, VodicState, WordReview } from './db'
import { VODIC, type VodicConfig } from './vodic-config'
import { addDays, dayOfWeek, daysBetween } from './vodic-plan'

// --- Korak 1: ponavljanje riječi ---

// Redoslijed: riječi koje su jučer pale dvaput zaredom, pa zadnjih 25 dodanih, pa 10 nasumičnih starijih.
export function wordsForReview(
  words: MyWord[],
  reviews: WordReview[],
  date: string,
  random: () => number = Math.random,
  config: VodicConfig = VODIC,
): MyWord[] {
  const byId = new Map(reviews.map((r) => [r.id, r]))
  const newestFirst = [...words].sort((a, b) => b.addedAt - a.addedAt)
  const priority = newestFirst.filter((w) => {
    const p = byId.get(w.id)?.priorityOn
    return p !== undefined && p <= date
  })
  const recent = newestFirst.slice(0, config.wordReview.recent)
  const older = newestFirst.slice(config.wordReview.recent)
  const picked: MyWord[] = []
  const pool = [...older]
  while (picked.length < config.wordReview.older && pool.length) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  const seen = new Set<string>()
  return [...priority, ...recent, ...picked].filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true)))
}

export function afterWordReview(r: WordReview | undefined, id: string, ok: boolean, date: string, config: VodicConfig = VODIC): WordReview {
  const base: WordReview = r ?? { id, v: 1, nisamStreak: 0, nisamTotal: 0, lastOn: date }
  if (ok) return { ...base, nisamStreak: 0, lastOn: date, priorityOn: undefined }
  const streak = base.nisamStreak + 1
  return {
    ...base,
    nisamStreak: streak,
    nisamTotal: base.nisamTotal + 1,
    lastOn: date,
    priorityOn: streak >= config.wordReview.nisamStreakForTomorrow ? addDays(date, 1) : base.priorityOn,
  }
}

// --- Korak 5: konjugator ---

// Oblici reda tablice (prazno = svi).
export function rowForms(row: number, config: VodicConfig = VODIC): string[] {
  const r = config.konjugatorRows[Math.min(row, config.konjugatorRows.length - 1)]
  return r.all ? [] : [...new Set([...r.new, ...r.mix])]
}

// Prijeći na idući red ako su zadnje dvije sesije (od početka reda, u oblicima reda) imale barem 9/10 "Znao".
export function konjugatorAdvance(state: VodicState, attempts: ConjAttempt[], config: VodicConfig = VODIC): VodicState {
  if (state.konjRow >= config.konjugatorRows.length - 1) return state
  const forms = rowForms(state.konjRow, config)
  const since = state.konjRowSince ?? 0
  const recent = sessions(
    attempts.filter((a) => a.at >= since),
    forms.length ? forms : undefined,
  ).slice(-config.konjugatorPassSessions)
  if (recent.length < config.konjugatorPassSessions || !recent.every((s) => s.passed)) return state
  return { ...state, konjRow: state.konjRow + 1, konjRowSince: Date.now() }
}

// --- Korak 3: treća rečenica ---

// Ishod treće rečenice: prošla fazu D iz prve → niz se briše; nije → niz raste, a nakon 3 dana zaredom
// vodič se idućih 7 dana vraća na 2 rečenice dnevno.
export function afterThird(state: VodicState, passedFirstTime: boolean, date: string, config: VodicConfig = VODIC): VodicState {
  if (passedFirstTime) return { ...state, thirdFailStreak: 0 }
  const streak = state.thirdFailStreak + 1
  if (streak >= config.third.failStreakDays) {
    return { ...state, thirdFailStreak: 0, thirdBackoffUntil: addDays(date, config.third.backoffDays) }
  }
  return { ...state, thirdFailStreak: streak }
}

// --- Subota: test priče ---

export const nextMonday = (date: string) => addDays(date, 8 - dayOfWeek(date))

// Najviše 2 neuspjele rečenice → priča gotova i sljedeća kreće u ponedjeljak; inače neuspjele idu na doradu.
export function afterStoryTest(
  state: VodicState,
  storyId: string,
  failed: number[],
  sentences: SentenceState[],
  date: string,
  config: VodicConfig = VODIC,
): { state: VodicState; sentences: SentenceState[]; passed: boolean } {
  const passed = failed.length <= config.storyTestMaxFails
  const changed = sentences
    .filter((s) => s.storyId === storyId && failed.includes(s.index))
    .map((s) => ({ ...s, status: 'u-radu' as const, dPassedOn: undefined, fails: (s.fails ?? 0) + 1, updatedAt: Date.now() }))
  if (!passed) return { state, sentences: changed, passed }
  return {
    state: { ...state, storyIndex: state.storyIndex + 1, storyStartedOn: nextMonday(date) },
    sentences: changed,
    passed,
  }
}

// --- Traka "Naruči novu priču" ---

// Neučene rečenice (status "nova") u tekućoj i budućim pričama iz reda.
export function unlearnedLeft(
  state: VodicState,
  stories: { id: string; sentenceCount: number }[],
  sentences: SentenceState[],
  config: VodicConfig = VODIC,
): number {
  const status = new Map(sentences.map((s) => [s.id, s.status]))
  return config.storyOrder.slice(state.storyIndex).reduce((n, id) => {
    const count = stories.find((s) => s.id === id)?.sentenceCount ?? 0
    return n + Array.from({ length: count }, (_, i) => i).filter((i) => (status.get(`${id}:${i}`) ?? 'nova') === 'nova').length
  }, 0)
}

// Sljedeća tema s popisa: prema broju priča koje već postoje iza prve tri.
export function nextTopic(storyCount: number, config: VodicConfig = VODIC) {
  return config.storyTopics[Math.max(0, storyCount - 3)] ?? null
}

// --- Tjedni izvještaj za Claudea ---

export type ReportInput = {
  date: string
  state: VodicState
  storyTitle: (id: string) => string
  sentenceText: (storyId: string, index: number) => string
  sentences: SentenceState[]
  days: DayLog[]
  attempts: ConjAttempt[]
  myWordsCount: number
  reviews: WordReview[]
  config?: VodicConfig
}

export function weeklyReport(r: ReportInput): string {
  const config = r.config ?? VODIC
  const start = r.state.startDate ?? config.startDate
  const week = Math.floor(Math.max(0, daysBetween(start, r.date)) / 7) + 1
  const weekStart = addDays(r.date, 1 - dayOfWeek(r.date))
  const inWeek = (d?: string) => !!d && d >= weekStart && d <= r.date
  const storyId = config.storyOrder[Math.min(r.state.storyIndex, config.storyOrder.length - 1)]
  const doneWeek = r.sentences.filter((s) => s.status === 'gotova' && inWeek(s.doneOn)).length
  const doneAll = r.sentences.filter((s) => s.status === 'gotova').length
  const failing = r.sentences.filter((s) => (s.fails ?? 0) >= 2).slice(0, 4)
  const weekAttempts = r.attempts.filter((a) => inWeek(new Date(a.at).toISOString().slice(0, 10)))
  const passedSessions = sessions(weekAttempts).filter((s) => s.passed).length
  const weak = weakPoints(r.attempts).slice(0, 5)
  const weakW = weakWords(r.attempts).slice(0, 5)
  const worstWords = [...r.reviews].sort((a, b) => b.nisamTotal - a.nisamTotal).filter((x) => x.nisamTotal > 0).slice(0, 5)
  const reading = (from: string, to: string) =>
    r.days.filter((d) => d.date >= from && d.date <= to && d.readingSec).map((d) => d.readingSec!)
  const thisRead = reading(weekStart, r.date).at(-1)
  const lastRead = reading(addDays(weekStart, -7), addDays(weekStart, -1)).at(-1)
  const trained = new Set(r.days.filter((d) => d.done.length > 0 && inWeek(d.date)).map((d) => d.date))
  const elapsed = Math.min(7, daysBetween(weekStart, r.date) + 1)
  const missed = elapsed - trained.size
  const shortUsed = r.days.filter((d) => d.short && inWeek(d.date)).length
  const fmt = (sec?: number) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '–')

  const lines = [
    `Tjedni izvještaj (tjedan ${week}, ${weekStart} – ${r.date})`,
    `Priča: ${r.storyTitle(storyId)}. Gotovih rečenica: ovaj tjedan ${doneWeek}, ukupno ${doneAll}.`,
    failing.length ? 'Rečenice koje su pale 2+ puta:' : 'Nema rečenica koje su pale 2+ puta.',
    ...failing.map((s) => `- ${r.sentenceText(s.storyId, s.index)} (${s.fails}×)`),
    `Konjugator: red ${r.state.konjRow + 1}, sesija s 9/10+ ovaj tjedan: ${passedSessions}.`,
    weak.length ? 'Najslabije točke konjugatora (Nisam u zadnjih 20):' : 'Konjugator: nema slabih točaka.',
    ...weak.map((p) => `- ${p.form} · ${p.rule}: ${Math.round((100 * p.recentFails) / p.recentCount)} %`),
    ...(weakW.length ? [`Riječi koje padaju u konjugatoru: ${weakW.map((w) => w.word).join(', ')}`] : []),
    `Moje riječi: ${r.myWordsCount}.${worstWords.length ? ` Najviše "Nisam": ${worstWords.map((w) => `${w.id.split('|')[0]} (${w.nisamTotal})`).join(', ')}` : ''}`,
    `Čitanje priče: ovaj tjedan ${fmt(thisRead)}, prošli ${fmt(lastRead)}.`,
    `Propušteni dani: ${missed}. Skraćeni plan: ${shortUsed}×.`,
  ]
  return lines.slice(0, config.reportMaxLines).join('\n')
}
