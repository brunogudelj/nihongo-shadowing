// FSRS kartice (biblioteka ts-fsrs): riječi i fraze. Jedina veza među sesijama.
// Ocjena je samo Znao (Good) ili Nisam (Again). Čiste funkcije su testirane u cards.test.ts;
// funkcije na dnu (syncCards, saveRating) rade s bazom.
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from 'ts-fsrs'
import { db, type CardKind, type CardLog, type CardRow, type MyWord, type SentenceState, type WordAttempt, type WordReview } from './db'
import { KARTICE, VODIC } from './vodic-config'

type Config = typeof KARTICE

const DAY = 86_400_000

export const cardId = (kind: CardKind, ref: string) => `${kind}:${ref}`

export function scheduler(config: Config = KARTICE) {
  return fsrs(
    generatorParameters({
      request_retention: config.retention,
      maximum_interval: config.maxIntervalDays,
      learning_steps: [...config.learningSteps],
      relearning_steps: [...config.relearningSteps],
      enable_fuzz: false,
      enable_short_term: true,
    }),
  )
}

// --- Pretvorba između retka u bazi (milisekunde) i kartice biblioteke (Date) ---

function toCard(r: CardRow): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: 0,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state as State,
    last_review: r.last_review === undefined ? undefined : new Date(r.last_review),
  }
}

function toRow(c: Card, kind: CardKind, ref: string, createdAt: number, extra: Partial<CardRow> = {}): CardRow {
  return {
    id: cardId(kind, ref),
    v: 1,
    kind,
    ref,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review?.getTime(),
    createdAt,
    ...extra,
  }
}

// --- Ocjena ---

// Ocijeni karticu (ili uvedi novu, ako je još nema). Vraća novu verziju kartice i zapis ocjene; ništa ne sprema.
export function rateCard(
  row: CardRow | undefined,
  kind: CardKind,
  ref: string,
  ok: boolean,
  now: number,
  session?: string,
  config: Config = KARTICE,
): { card: CardRow; log: CardLog } {
  const wasNew = !row || row.state === State.New
  const before = row ? toCard(row) : createEmptyCard(new Date(now))
  const { card } = scheduler(config).next(before, new Date(now), ok ? Rating.Good : Rating.Again)
  const next = toRow(card, kind, ref, row?.createdAt ?? now)
  const log: CardLog = { id: `${next.id}@${now}`, v: 1, cardId: next.id, kind, at: now, ok, wasNew, session }
  return { card: next, log }
}

// Početak lokalnog dana (ponoć) za trenutak `now`.
export function dayStart(now: number): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// Koliko je novih kartica ove vrste danas uvedeno, i koliko ih se još smije uvesti.
export function newLeftToday(logs: CardLog[], kind: CardKind, now: number, config: Config = KARTICE): number {
  const from = dayStart(now)
  const used = logs.filter((l) => l.kind === kind && l.wasNew && l.at >= from && l.at < from + DAY).length
  return Math.max(0, config.newPerDay[kind] - used)
}

// Kartice kojima je rok prošao, od one koja najviše kasni.
export const dueCards = (cards: CardRow[], kind: CardKind, now: number) =>
  cards.filter((c) => c.kind === kind && c.due <= now).sort((a, b) => a.due - b.due)

// --- Prijenos starog napretka u kartice ---

export type SeedInput = {
  sentences: SentenceState[]
  myWords: MyWord[]
  wordReviews: WordReview[]
  wordAttempts: WordAttempt[]
  existing: Set<string> // id-jevi kartica koje već postoje (njih ne dira)
  now: number
  config?: Config
  reviewIntervals?: number[]
}

// "YYYY-MM-DD" → lokalna ponoć tog dana (ms).
const localDay = (date: string) => new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)).getTime()

// Kartica koja se zna i ponavlja se za `stabilityDays` dana, s rokom `due`.
function reviewCard(kind: CardKind, ref: string, stabilityDays: number, due: number, reps: number, now: number): CardRow {
  const c = createEmptyCard(new Date(now))
  return toRow(
    {
      ...c,
      state: State.Review,
      stability: stabilityDays,
      difficulty: 5,
      scheduled_days: stabilityDays,
      reps,
      due: new Date(due),
      last_review: new Date(due - stabilityDays * DAY),
    },
    kind,
    ref,
    now,
    { seeded: true },
  )
}

// Kartica u učenju, na redu odmah (kao da je upravo bila "Nisam").
function learningCard(kind: CardKind, ref: string, now: number, config: Config): CardRow {
  const { card } = scheduler(config).next(createEmptyCard(new Date(now)), new Date(now), Rating.Again)
  return toRow({ ...card, due: new Date(now) }, kind, ref, now, { seeded: true })
}

// Iz statusa rečenica i dosadašnjeg ponavljanja riječi složi kartice koje još ne postoje.
// Gotova rečenica → kartica koja se zna (rok kao u starom rasporedu). Rečenica u radu → kartica u učenju.
// Riječ koju si već ponavljao → zna se (zadnji put Znao) ili u učenju (zadnji put Nisam).
// Nova rečenica i riječ koju još nisi ponavljao ostaju bez kartice: uvode se kao nove, uz dnevno ograničenje.
export function seedCards(input: SeedInput): CardRow[] {
  const config = input.config ?? KARTICE
  const intervals = input.reviewIntervals ?? VODIC.reviewIntervals
  const { now, existing } = input
  const out: CardRow[] = []

  for (const s of input.sentences) {
    const ref = `${s.storyId}:${s.index}`
    if (existing.has(cardId('fraza', ref))) continue
    if (s.status === 'gotova') {
      const idx = Math.min(s.intervalIdx ?? 0, intervals.length - 1)
      out.push(reviewCard('fraza', ref, intervals[idx], s.due ? localDay(s.due) : now, idx + 1, now))
    } else if (s.status === 'u-radu') {
      out.push(learningCard('fraza', ref, now, config))
    }
  }

  // Zadnji odgovor po riječi: iz ponavljanja riječi (zapisi s vremenom) ili iz koraka vodiča (samo dan).
  const last = new Map<string, { at: number; ok: boolean }>()
  const note = (id: string, at: number, ok: boolean) => {
    const prev = last.get(id)
    if (!prev || at >= prev.at) last.set(id, { at, ok })
  }
  for (const r of input.wordReviews) note(r.id, localDay(r.lastOn), r.nisamStreak === 0)
  for (const a of input.wordAttempts) note(`${a.word}|${a.reading}`, a.at, a.result === 'znao')

  for (const w of input.myWords) {
    if (existing.has(cardId('rijec', w.id))) continue
    const l = last.get(w.id)
    if (!l) continue
    const days = config.seedWordStabilityDays
    out.push(l.ok ? reviewCard('rijec', w.id, days, l.at + days * DAY, 1, now) : learningCard('rijec', w.id, now, config))
  }
  return out
}

// --- Rad s bazom ---

// Napravi kartice za stari napredak koji ih još nema. Sigurno je pokretati više puta (postojeće ne dira).
// Pokreće se pri otvaranju aplikacije i nakon uvoza sigurnosne kopije.
export async function syncCards(now = Date.now()): Promise<number> {
  return db.transaction('rw', [db.cards, db.sentences, db.myWords, db.wordReviews, db.wordAttempts], async () => {
    const seeded = seedCards({
      sentences: await db.sentences.toArray(),
      myWords: await db.myWords.toArray(),
      wordReviews: await db.wordReviews.toArray(),
      wordAttempts: await db.wordAttempts.toArray(),
      existing: new Set((await db.cards.toCollection().primaryKeys()).map(String)),
      now,
    })
    if (seeded.length) await db.cards.bulkAdd(seeded)
    return seeded.length
  })
}

// Spremi ocjenu kartice (i uvedi je, ako je nova).
export async function saveRating(kind: CardKind, ref: string, ok: boolean, session?: string, now = Date.now()): Promise<CardRow> {
  return db.transaction('rw', db.cards, db.cardLogs, async () => {
    const { card, log } = rateCard(await db.cards.get(cardId(kind, ref)), kind, ref, ok, now, session)
    await db.cards.put(card)
    await db.cardLogs.put(log)
    return card
  })
}
