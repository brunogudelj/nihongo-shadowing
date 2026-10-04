// Planer vodiča (dorada 1V): iz stanja, statusa rečenica i dnevnika dana složi današnji trening
// po pravilima iz vodic-config.ts. Čiste funkcije, bez baze i bez zaslona, pa se mogu testirati.
import type { DayLog, SentenceState, VodicState } from './db'
import { VODIC, type StepId, type VodicConfig } from './vodic-config'

// --- Datumi (lokalni dan kao 'YYYY-MM-DD'; računanje u UTC da ljetno vrijeme ne smeta) ---

export function today(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const toUtc = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
export const addDays = (date: string, n: number) => new Date(toUtc(date) + n * 86_400_000).toISOString().slice(0, 10)
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000)
// 1 = ponedjeljak … 7 = nedjelja
export const dayOfWeek = (date: string) => ((new Date(toUtc(date)).getUTCDay() + 6) % 7) + 1

// --- Ulaz i izlaz planera ---

export type SentenceRef = { storyId: string; index: number }
export type StoryInfo = { id: string; sentenceCount: number }

export type PlanInput = {
  date: string
  state: VodicState
  sentences: SentenceState[]
  days: DayLog[]
  stories: StoryInfo[]
  short?: boolean
  config?: VodicConfig
}

export type PlanKind = 'prije-pocetka' | 'radni' | 'subota' | 'nedjelja' | 'povratak' | 'skraceni'

export type Plan = {
  date: string
  kind: PlanKind
  storyId: string
  steps: { id: StepId; minutes: number }[]
  totalMinutes: number
  newSentences: SentenceRef[] // korak 3: nove rečenice (faze A–D)
  rework: SentenceRef[] // u radu, a faza D još nije prošla (dorada; i u koraku 3 prije novih)
  cleanTest: SentenceRef[] // korak 4: prošle fazu D prije današnjeg dana
  warmup: SentenceRef[] // korak 2: gotove kojima je danas (ili ranije) rok
  konj: { row: number; forms: string[]; source: 'price' | 'sve' }
  canOfferThird: boolean
  missedDays: number
}

export function initialState(config: VodicConfig = VODIC): VodicState {
  return {
    id: 'stanje',
    v: 1,
    storyIndex: 0,
    storyStartedOn: config.startDate,
    konjRow: config.konjugatorStartRow,
    thirdFailStreak: 0,
  }
}

const ref = (s: SentenceState): SentenceRef => ({ storyId: s.storyId, index: s.index })

export function planDay(input: PlanInput): Plan {
  const config = input.config ?? VODIC
  const { state } = input
  const startDate = state.startDate ?? config.startDate
  const beforeStart = input.date < startDate
  // Prije početka vodič pokazuje plan za prvi dan.
  const date = beforeStart ? startDate : input.date
  const storyId = config.storyOrder[Math.min(state.storyIndex, config.storyOrder.length - 1)]
  const story = input.stories.find((s) => s.id === storyId)
  const byId = new Map(input.sentences.map((s) => [s.id, s]))
  const statusOf = (sid: string, i: number) => byId.get(`${sid}:${i}`)?.status ?? 'nova'

  // Propušteni dani: od zadnjeg dana s odrađenim korakom do danas.
  const trained = input.days.filter((d) => d.done.length > 0 && d.date < date).map((d) => d.date)
  const last = trained.sort().at(-1)
  const missedDays = last ? Math.max(0, daysBetween(last, date) - 1) : 0

  // Prvi dan vodiča je uvijek običan dan (i ako je pokrenut vikendom).
  const firstDay = trained.length === 0
  const dow = firstDay ? 1 : dayOfWeek(date)
  let kind: PlanKind = beforeStart ? 'prije-pocetka' : 'radni'
  let steps = config.day
  if (input.short) {
    kind = 'skraceni'
    steps = config.short
  } else if (missedDays >= config.missedDaysForReviewOnly) {
    // Povratak nakon duže pauze: samo ponavljanje, bez novih rečenica i novih riječi.
    kind = 'povratak'
    steps = config.day.filter((s) => s.id !== 'nove-rijeci').map((s) => (s.id === 'nove' ? { ...s, id: 'dorada' } : s))
  } else if (dow === 7) {
    kind = beforeStart ? kind : 'nedjelja'
    steps = config.sunday
  } else if (dow === 6) {
    kind = beforeStart ? kind : 'subota'
    steps = config.day.map((s) => ({ ...s, id: config.saturdayReplaces[s.id] ?? s.id }))
  }

  // Rečenice tekuće priče.
  const storySentences = Array.from({ length: story?.sentenceCount ?? 0 }, (_, i) => i)
  const retry = storySentences.find((i) => byId.get(`${storyId}:${i}`)?.retryFirst)
  let newSentences: SentenceRef[] = []
  if (steps.some((s) => s.id === 'nove')) {
    newSentences =
      retry !== undefined
        ? [{ storyId, index: retry }] // dvaput pala fazu D: danas samo ona
        : storySentences
            .filter((i) => statusOf(storyId, i) === 'nova')
            .slice(0, config.newPerDay)
            .map((index) => ({ storyId, index }))
    // Nema više novih: korak 3 postaje dorada.
    if (newSentences.length === 0) steps = steps.map((s) => (s.id === 'nove' ? { ...s, id: 'dorada' } : s))
  }

  const rework = input.sentences
    .filter((s) => s.storyId === storyId && s.status === 'u-radu' && !s.dPassedOn && !s.retryFirst)
    .sort((a, b) => a.index - b.index)
    .map(ref)
  const cleanTest = input.sentences
    .filter((s) => s.status === 'u-radu' && s.dPassedOn && s.dPassedOn < date)
    .sort((a, b) => a.storyId.localeCompare(b.storyId) || a.index - b.index)
    .map(ref)
  const warmup = input.sentences
    .filter((s) => s.status === 'gotova' && s.due && s.due <= date)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || a.index - b.index)
    .map(ref)

  const row = config.konjugatorRows[Math.min(state.konjRow, config.konjugatorRows.length - 1)]
  const konj = {
    row: state.konjRow,
    forms: row.all ? [] : [...new Set([...row.new, ...row.mix])], // prazno = svi oblici
    source: (daysBetween(state.storyStartedOn, date) < config.storyWordsDays ? 'price' : 'sve') as 'price' | 'sve',
  }

  return {
    date,
    kind,
    storyId,
    steps,
    totalMinutes: steps.reduce((n, s) => n + s.minutes, 0),
    newSentences,
    rework,
    cleanTest,
    warmup,
    konj,
    canOfferThird: !state.thirdBackoffUntil || state.thirdBackoffUntil <= date,
    missedDays,
  }
}

// --- Promjene stanja rečenice (vraćaju novu verziju, ne spremaju) ---

const base = (s: SentenceState | undefined, r: SentenceRef): SentenceState =>
  s ?? { id: `${r.storyId}:${r.index}`, storyId: r.storyId, index: r.index, status: 'nova', updatedAt: 0 }

// Faza D prošla (sva tri pitanja "Da"): u radu, sutra Čisto test.
export function afterDPassed(s: SentenceState | undefined, r: SentenceRef, date: string): SentenceState {
  return { ...base(s, r), status: 'u-radu', dPassedOn: date, retryFirst: false, updatedAt: Date.now() }
}

// Faza D nije prošla ni drugi put: sutra je prva nova, i tog dana nijedna druga.
export function afterDFailedTwice(s: SentenceState | undefined, r: SentenceRef): SentenceState {
  const b = base(s, r)
  return { ...b, status: b.status === 'gotova' ? 'gotova' : 'u-radu', retryFirst: true, dPassedOn: undefined, fails: (b.fails ?? 0) + 1, updatedAt: Date.now() }
}

// Čisto test: "Da" → gotova (prvo ponavljanje za 1 dan); "Ne" → ostaje u radu, sutra opet faza D.
export function afterCleanTest(s: SentenceState, ok: boolean, date: string, config: VodicConfig = VODIC): SentenceState {
  if (ok) return { ...s, status: 'gotova', doneOn: date, intervalIdx: 0, due: addDays(date, config.reviewIntervals[0]), updatedAt: Date.now() }
  return { ...s, status: 'u-radu', dPassedOn: undefined, fails: (s.fails ?? 0) + 1, updatedAt: Date.now() }
}

// Zagrijavanje: "Da" → idući rok iz rasporeda (1, 3, 7, 14, 30, pa svakih 30); "Ne" → rok se vraća na 1 dan.
export function afterWarmup(s: SentenceState, ok: boolean, date: string, config: VodicConfig = VODIC): SentenceState {
  const iv = config.reviewIntervals
  if (!ok) return { ...s, intervalIdx: 0, due: addDays(date, iv[0]), fails: (s.fails ?? 0) + 1, updatedAt: Date.now() }
  const idx = Math.min((s.intervalIdx ?? 0) + 1, iv.length - 1)
  return { ...s, intervalIdx: idx, due: addDays(date, iv[idx]), updatedAt: Date.now() }
}
