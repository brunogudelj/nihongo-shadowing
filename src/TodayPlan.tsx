// Početni zaslon: kratka sesija. Izbor trajanja (5 / 10 / 15 min), "Započni sesiju", brojač sesija i minuta
// (danas prema dnevnom cilju, i ukupno). Sesiju složi sastavljač (vodic-plan.ts, planSession).
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { cardId } from './cards'
import { db, wordId } from './db'
import { readSetting, writeSetting } from './settings'
import { stories } from './stories'
import { SESIJA, VODIC, type BlockId } from './vodic-config'
import { formatMinutes, planSession, sessionStats } from './vodic-plan'
import { nextTopic } from './vodic-rules'
import { BLOCK_TITLE, STORY_INFO, titleOf } from './vodic-text'

const [GOAL_MIN, GOAL_MAX] = SESIJA.goalRange

function loadMinutes(): number {
  const v = Number(readSetting('sesija-trajanje'))
  return SESIJA.durations.includes(v) ? v : SESIJA.durations[SESIJA.durations.length - 1]
}
function loadGoal(): number {
  const v = Number(readSetting('sesija-cilj'))
  return v >= GOAL_MIN && v <= GOAL_MAX ? v : SESIJA.defaultGoal
}

// Privremeno (do zaslona sesije): završi sesiju sa stvarnim proteklim vremenom.
const finishSession = (id: string) => db.sessionLogs.update(id, { endedAt: Date.now() })

// 1 sesija, 2–4 sesije, 5 sesija, 22 sesije…
const sesija = (n: number) => (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'sesije' : 'sesija')

export default function TodayPlan() {
  const [minutes, setMinutes] = useState(loadMinutes)
  const [goal, setGoal] = useState(loadGoal)
  const data = useLiveQuery(async () => ({
    cards: await db.cards.toArray(),
    logs: await db.cardLogs.toArray(),
    myWords: await db.myWords.toArray(),
    sessions: await db.sessionLogs.toArray(),
    now: Date.now(), // "danas" za brojač; upit se ponavlja kad se baza promijeni
  }))
  if (!data) return null

  const stats = sessionStats(data.sessions, data.now)
  // Započeta, a nezavršena sesija (zadnja bez kraja).
  const active = data.sessions.filter((s) => s.endedAt === undefined).sort((a, b) => b.startedAt - a.startedAt)[0]
  const hasCard = new Set(data.cards.map((c) => c.id))
  // Neučene rečenice (bez kartice) u redu priča, za traku "Naruči novu priču".
  const left = VODIC.storyOrder.reduce((n, id) => {
    const count = STORY_INFO.find((s) => s.id === id)?.sentenceCount ?? 0
    return n + Array.from({ length: count }, (_, i) => i).filter((i) => !hasCard.has(cardId('fraza', `${id}:${i}`))).length
  }, 0)
  const topic = nextTopic(stories.length)

  function choose(m: number) {
    setMinutes(m)
    writeSetting('sesija-trajanje', String(m))
  }
  function changeGoal(d: number) {
    const g = Math.min(GOAL_MAX, Math.max(GOAL_MIN, goal + d))
    setGoal(g)
    writeSetting('sesija-cilj', String(g))
  }

  async function start() {
    // Popis riječi je velik, pa se učitava tek ovdje (za "Nove riječi": koliko ih još nije u tvojim riječima).
    const vocab = (await import('../data/rijeci.json')).default as { word: string; reading: string }[]
    const mine = new Set(data!.myWords.map((w) => w.id))
    const session = planSession({
      minutes,
      now: Date.now(),
      cards: data!.cards,
      logs: data!.logs,
      stories: STORY_INFO,
      newWordCandidates: data!.myWords.filter((w) => !hasCard.has(cardId('rijec', w.id))).length,
      vocabLeft: vocab.filter((w) => !mine.has(wordId(w.word, w.reading))).length,
    })
    const startedAt = Date.now()
    await db.sessionLogs.put({
      id: `sesija-${startedAt}`,
      v: 1,
      startedAt,
      minutes,
      blocks: session.blocks.map((b) => b.id),
      storyId: session.storyId,
    })
  }


  const btn = 'rounded-xl font-semibold'
  return (
    <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xl font-semibold">🧭 Sesija</p>

      {active ? (
        <>
          <p className="mt-2 text-sm text-stone-500">
            Sesija od {active.minutes} min · <span lang="ja">{titleOf(active.storyId)}</span>
          </p>
          <ol className="mt-2 flex flex-col gap-2">
            {active.blocks.map((b, i) => (
              <li key={b} className="flex gap-3">
                <span className="w-6 shrink-0 text-right text-stone-400">{i + 1}.</span>
                <span className="min-w-0 flex-1 font-semibold">{BLOCK_TITLE[b as BlockId] ?? b}</span>
                <span className="shrink-0 text-sm text-stone-500">{SESIJA.blocks[b as BlockId]} min</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Izvođenje blokova (tajmer, Znao / Nisam, sažetak) dolazi u idućem koraku. Zasad možeš sesiju završiti ručno.
          </p>
          <button
            onClick={() => void finishSession(active.id)}
            className={`${btn} mt-3 w-full bg-emerald-600 py-3 text-lg text-white active:bg-emerald-700`}
          >
            ✓ Završi sesiju
          </button>
          <button onClick={() => void db.sessionLogs.delete(active.id)} className="mt-2 w-full py-2 text-sm text-stone-500">
            Odustani (ne broji se)
          </button>
        </>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SESIJA.durations.map((m) => (
              <button
                key={m}
                onClick={() => choose(m)}
                aria-pressed={minutes === m}
                className={`${btn} py-3 ${minutes === m ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-700 active:bg-stone-200'}`}
              >
                {m} min
              </button>
            ))}
          </div>
          <button
            onClick={() => void start()}
            className={`${btn} mt-3 w-full bg-red-700 py-4 text-lg text-white active:bg-red-800`}
          >
            ▶ Započni sesiju
          </button>
        </>
      )}

      {/* Brojač: danas prema cilju, i ukupno. */}
      <div className="mt-4 flex flex-col gap-1 text-sm">
        <p>
          <span className="inline-block w-16 text-stone-500">Danas:</span>
          <span className={`font-semibold ${stats.todayCount >= goal ? 'text-emerald-700' : ''}`}>
            {stats.todayCount} / {goal} {sesija(goal)}
          </span>
          <span className="text-stone-500"> · {formatMinutes(stats.todayMinutes)}</span>
          {stats.todayCount >= goal && ' ✓'}
        </p>
        <p>
          <span className="inline-block w-16 text-stone-500">Ukupno:</span>
          <span className="font-semibold">
            {stats.totalCount} {sesija(stats.totalCount)}
          </span>
          <span className="text-stone-500"> · {formatMinutes(stats.totalMinutes)}</span>
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-stone-500">Dnevni cilj:</span>
          <button
            onClick={() => changeGoal(-1)}
            disabled={goal <= GOAL_MIN}
            aria-label="Smanji cilj"
            className="h-10 w-10 rounded-full bg-stone-100 text-lg font-semibold active:bg-stone-200 disabled:opacity-40"
          >
            −
          </button>
          <span className="w-6 text-center font-semibold">{goal}</span>
          <button
            onClick={() => changeGoal(1)}
            disabled={goal >= GOAL_MAX}
            aria-label="Povećaj cilj"
            className="h-10 w-10 rounded-full bg-stone-100 text-lg font-semibold active:bg-stone-200 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Narudžba nove priče: u redu je ostalo malo neučenih rečenica. */}
      {left < VODIC.orderStoryBelow && topic && (
        <div className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
          <p className="font-semibold">📝 Naruči novu priču (ostalo {left} neučenih rečenica)</p>
          <p className="mt-1">
            Tema: {topic.tema}. Gramatička meta: <span lang="ja">{topic.meta}</span>
          </p>
        </div>
      )}
    </section>
  )
}
