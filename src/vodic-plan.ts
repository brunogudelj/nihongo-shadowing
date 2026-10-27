// Planer vodiča (dorada 1V): iz stanja, statusa rečenica i dnevnika dana složi današnji trening
// po pravilima iz vodic-config.ts. Na dnu: sastavljač kratke sesije (planSession).
// Čiste funkcije, bez baze i bez zaslona, pa se mogu testirati.
import { cardId, dayStart, dueCards, newLeftToday } from './cards'
import type { CardLog, CardRow, DayLog, MyWord, SentenceState, SessionLog, VodicState } from './db'
import { SESIJA, VODIC, type BlockId, type StepId, type VodicConfig } from './vodic-config'

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
export type StoryInfo = { id: string; sentenceCount: number; theme?: string; level?: 'light' | 'fat'; base?: string }

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

// --- Kratka sesija: nasumični blokovi, zbroj točno izabrano trajanje (5, 10 ili 15 min) ---

export type SessionInput = {
  minutes: number
  now: number
  cards: CardRow[]
  logs: CardLog[] // ocjene kartica (za dnevno ograničenje novih)
  stories: StoryInfo[]
  storyOrder?: string[]
  newWordCandidates: number // tvoje riječi koje još nemaju karticu
  vocabLeft: number // riječi s popisa koje još nisu u tvojim riječima (za Sljedećih 8)
  random?: () => number
  config?: typeof SESIJA
}

export type Session = {
  minutes: number
  blocks: { id: BlockId; minutes: number }[]
  storyId: string // tekuća priča (za blokove Priča i Nova rečenica)
  newSentence: SentenceRef | null // sljedeća rečenica bez kartice
  dueWords: number
  dueFraze: number
}

// Red priča: prvo one iz vodic-config.ts, zatim sve ostale po imenu (nova priča uđe u red sama).
// Dnevne vijesti nisu u redu priča (nemaju kartice, brišu se nakon 30 dana); imaju svoj blok.
export const isNews = (id: string) => id.startsWith('vijesti-')
export const latestNews = (stories: StoryInfo[]) => stories.map((s) => s.id).filter(isNews).sort().at(-1) ?? null
// Najnovija vijest u obje razine: fat građena na light (polje base). Starije vijesti imaju samo fat.
export function newsPair(stories: StoryInfo[]): { light: string | null; fat: string | null } {
  const id = latestNews(stories)
  const latest = stories.find((s) => s.id === id)
  if (!latest) return { light: null, fat: null }
  if (latest.level === 'fat') return { light: latest.base ?? null, fat: latest.id }
  return { light: latest.id, fat: null }
}

// Tema po tema: unutar teme prvo light priče, zatim fat (fat se gradi na light, pa dolazi tek kad je light naučena).
// Teme idu redom iz vodic-config.ts, zatim ostale po imenu.
export function storyQueue(stories: StoryInfo[], storyOrder: string[] = VODIC.storyOrder): string[] {
  const list = stories.filter((s) => !isNews(s.id))
  const themeOf = (s: StoryInfo) => s.theme ?? s.id.replace(/-\d{3}$/, '')
  const rank = (s: StoryInfo) => {
    const i = storyOrder.indexOf(s.id)
    return i >= 0 ? i : storyOrder.length
  }
  // Mjesto teme: najranija njezina priča iz postavki, inače iza njih po imenu teme.
  const themeRank = new Map<string, number>()
  for (const s of list) themeRank.set(themeOf(s), Math.min(themeRank.get(themeOf(s)) ?? Infinity, rank(s)))
  const level = (s: StoryInfo) => (s.level === 'fat' ? 1 : 0)
  return [...list]
    .sort(
      (a, b) =>
        themeRank.get(themeOf(a))! - themeRank.get(themeOf(b))! ||
        themeOf(a).localeCompare(themeOf(b)) ||
        level(a) - level(b) ||
        a.id.localeCompare(b.id),
    )
    .map((s) => s.id)
}

// Tekuća priča: prva iz reda koja ima rečenicu bez kartice (ako je sve naučeno, zadnja).
export function currentStory(cards: CardRow[], stories: StoryInfo[], storyOrder: string[] = VODIC.storyOrder) {
  const has = new Set(cards.map((c) => c.id))
  const queue = storyQueue(stories, storyOrder)
  for (const id of queue) {
    const count = stories.find((s) => s.id === id)?.sentenceCount ?? 0
    for (let index = 0; index < count; index++) {
      if (!has.has(cardId('fraza', `${id}:${index}`))) return { storyId: id, newSentence: { storyId: id, index } }
    }
  }
  return { storyId: queue[queue.length - 1] ?? storyOrder[storyOrder.length - 1], newSentence: null }
}

// Koji su blokovi ponuđeni (imaju sadržaja) i koji moraju ući zbog zaostatka.
export function availableBlocks(input: SessionInput) {
  const config = input.config ?? SESIJA
  const { cards, logs, now } = input
  const { storyId, newSentence } = currentStory(cards, input.stories, input.storyOrder)
  const dueWords = dueCards(cards, 'rijec', now).length
  const dueFraze = dueCards(cards, 'fraza', now).length
  const storyStarted = cards.some((c) => c.kind === 'fraza' && c.ref.startsWith(`${storyId}:`))
  const offered: Record<BlockId, boolean> = {
    rijeci: dueWords > 0 || (input.newWordCandidates > 0 && newLeftToday(logs, 'rijec', now) > 0),
    fraze: dueFraze > 0,
    'nova-recenica': !!newSentence && newLeftToday(logs, 'fraza', now) > 0,
    prica: storyStarted,
    konjugator: true,
    citanje: true,
    'nove-rijeci': input.vocabLeft > 0,
    vijesti: latestNews(input.stories) !== null,
  }
  const due: Partial<Record<BlockId, number>> = { rijeci: dueWords, fraze: dueFraze }
  const ids = (Object.keys(config.blocks) as BlockId[]).filter((id) => offered[id])
  const forced = ids.filter((id) => config.backlog[id] !== undefined && (due[id] ?? 0) > config.backlog[id]!)
  return { ids, forced, storyId, newSentence, dueWords, dueFraze }
}

// Složi sesiju: od svih skupova različitih ponuđenih blokova čiji je zbroj točno `minutes` (i koji sadrže
// blokove sa zaostatkom) nasumično izaberi jedan, pa mu nasumično posloži redoslijed.
// Ako takvog skupa nema, uzmi one s najvećim zbrojem ispod trajanja.
export function planSession(input: SessionInput): Session {
  const config = input.config ?? SESIJA
  const random = input.random ?? Math.random
  const a = availableBlocks(input)
  const len = (id: BlockId) => config.blocks[id]

  // Blokovi sa zaostatkom koji stanu (prvo riječi, pa fraze).
  const forced: BlockId[] = []
  for (const id of a.forced) if (forced.reduce((n, f) => n + len(f), 0) + len(id) <= input.minutes) forced.push(id)
  const rest = a.ids.filter((id) => !forced.includes(id))

  const combos: BlockId[][] = []
  for (let mask = 0; mask < 1 << rest.length; mask++) {
    const combo = [...forced, ...rest.filter((_, i) => mask & (1 << i))]
    if (combo.reduce((n, id) => n + len(id), 0) <= input.minutes) combos.push(combo)
  }
  const best = Math.max(...combos.map((c) => c.reduce((n, id) => n + len(id), 0)))
  const fitting = combos.filter((c) => c.reduce((n, id) => n + len(id), 0) === best)
  const picked = [...fitting[Math.floor(random() * fitting.length)]]

  // Nasumični redoslijed (Fisher–Yates).
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[picked[i], picked[j]] = [picked[j], picked[i]]
  }
  return {
    minutes: input.minutes,
    blocks: picked.map((id) => ({ id, minutes: len(id) })),
    storyId: a.storyId,
    newSentence: a.newSentence,
    dueWords: a.dueWords,
    dueFraze: a.dueFraze,
  }
}

// --- Brojač sesija i minuta ---

// Završene sesije (one sa sažetkom): danas i ukupno. Minute su stvarno vrijeme, zaokruženo na cijelu minutu.
export function sessionStats(logs: SessionLog[], now: number) {
  const from = dayStart(now)
  const done = logs.filter((l) => l.endedAt !== undefined)
  const mins = (ls: SessionLog[]) => Math.round(ls.reduce((n, l) => n + (l.endedAt! - l.startedAt), 0) / 60_000)
  const today = done.filter((l) => l.startedAt >= from && l.startedAt < from + 86_400_000)
  return { todayCount: today.length, todayMinutes: mins(today), totalCount: done.length, totalMinutes: mins(done) }
}

// "9 h 20 min", "45 min"
export const formatMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`)

// --- Blokovi sesije ---

// Blok Riječi: prvo kartice na redu (od one koja najviše kasni), pa nove (tvoje riječi bez kartice,
// zadnje dodane prve) do dnevnog ograničenja.
export function wordQueue(cards: CardRow[], myWords: MyWord[], logs: CardLog[], now: number): string[] {
  const has = new Set(cards.map((c) => c.id))
  const fresh = myWords
    .filter((w) => !has.has(cardId('rijec', w.id)))
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, newLeftToday(logs, 'rijec', now))
  return [...dueCards(cards, 'rijec', now).map((c) => c.ref), ...fresh.map((w) => w.id)]
}

// Sažetak sesije: koliko je kartica ponovljeno i uvedeno, i kad je iduća na redu.
export function sessionSummary(sessionId: string, logs: CardLog[], cards: CardRow[], now: number) {
  const mine = logs.filter((l) => l.session === sessionId)
  const count = (kind: 'rijec' | 'fraza', isNew: boolean) =>
    new Set(mine.filter((l) => l.kind === kind && l.wasNew === isNew).map((l) => l.cardId)).size
  const upcoming = cards.filter((c) => c.due > now).sort((a, b) => a.due - b.due)
  const next = upcoming[0]?.due
  return {
    words: count('rijec', false),
    newWords: count('rijec', true),
    fraze: count('fraza', false),
    newFraze: count('fraza', true),
    nextDue: next,
    // Kartice koje dolaze na red u satu nakon iduće.
    nextCount: next === undefined ? 0 : upcoming.filter((c) => c.due <= next + 3_600_000).length,
  }
}

// "za 10 min", "za 3 h", "sutra", "za 4 dana"
export function formatWhen(due: number, now: number): string {
  const min = Math.max(1, Math.round((due - now) / 60_000))
  if (min < 60) return `za ${min} min`
  if (min < 24 * 60) return `za ${Math.round(min / 60)} h`
  const days = daysBetween(today(new Date(now)), today(new Date(due)))
  return days <= 1 ? 'sutra' : `za ${days} dana`
}
