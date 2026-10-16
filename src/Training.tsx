// Vodič "Današnji trening" (dorada 1V): provodi kroz korake plana dana, otvara alate s gotovim
// postavkama i bilježi odgovore na da/ne pitanja. Odluke donose pravila iz vodic-plan.ts i vodic-rules.ts.
import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import type { ConjPreset } from './Conjugator'
import { FORMS } from './conjugate'
import { cardId, dueCards, saveRating } from './cards'
import ContextSentence from './ContextSentence'
import { db, type DayLog, type DayProgress, type SentenceState, type SessionLog, type SessionProgress, type VodicState } from './db'
import { speak } from './speech'
import StoryPlayer, { type StoryPreset } from './StoryPlayer'
import { stories } from './stories'
import type { VocabPreset } from './Vocabulary'
import { SESIJA, VODIC, type BlockId } from './vodic-config'
import {
  afterCleanTest,
  afterDFailedTwice,
  afterDPassed,
  afterWarmup,
  currentStory,
  formatMinutes,
  formatWhen,
  initialState,
  planDay,
  sessionStats,
  sessionSummary,
  today,
  wordQueue,
  type Plan,
  type SentenceRef,
} from './vodic-plan'
import { readSetting } from './settings'
import { afterStoryTest, afterThird, afterWordReview, konjugatorAdvance, rowForms, weeklyReport, wordsForReview } from './vodic-rules'
import { BLOCK_TITLE, listOf, sentenceJa, STEP_TITLE, STORY_INFO, titleOf } from './vodic-text'

const Conjugator = lazy(() => import('./Conjugator'))
const Vocabulary = lazy(() => import('./Vocabulary'))
const MyWords = lazy(() => import('./MyWords'))

type Tool =
  | { kind: 'story'; storyId: string; preset: StoryPreset }
  | { kind: 'konj'; preset: ConjPreset }
  | { kind: 'vocab'; preset: VocabPreset }
  | { kind: 'moje' }

type Ctx = {
  date: string
  plan: Plan
  day: DayLog
  state: VodicState
  sentences: SentenceState[]
  progress: DayProgress
  setProgress: (p: DayProgress) => Promise<unknown>
  open: (t: Tool) => void
}

const id = (r: SentenceRef) => `${r.storyId}:${r.index}`

// Faze nove rečenice (plan učenja): svaka skida jednu pomoć.
const PHASES: Record<'A' | 'B' | 'C' | 'D', { title: string; text: string; preset: StoryPreset }> = {
  A: {
    title: 'Faza A: razumijevanje (2–3 min)',
    text: 'Pročitaj prijevod, u 🔍 Rendgenu dodirni svaku riječ koju ne znaš (nepoznate označi ☆), pa jednom poslušaj rečenicu na 0.85×.',
    preset: { view: 'rendgen', translation: true, speed: 0.85, loop: false },
  },
  B: {
    title: 'Faza B: blokovi na 0.7× (4 min)',
    text: 'Petlja je uključena. Dodirni prvi blok: prvi krug samo slušaj, zatim u stanci ponavljaj naglas, 4–5 krugova po bloku. Tako redom kroz sve blokove.',
    preset: { view: 'puno', translation: true, speed: 0.7, loop: true, pause: 1 },
  },
  C: {
    title: 'Faza C: cijela rečenica na 0.85× (3 min)',
    text: 'Petlja na cijeloj rečenici, bez prijevoda. Ponavljaj u stanci 5–6 puta. Čestice (plavo) ne gutaj, nastavci (narančasto) neka budu jasni.',
    preset: { view: 'puno', translation: false, speed: 0.85, loop: true, pause: 1 },
  },
  D: {
    title: 'Faza D: pravi shadowing na 1× (3 min)',
    text: 'Prva 2–3 kruga ponavljaj u stanci. Zatim govori istovremeno s Nanami, pola sloga iza nje. Ako zapneš, vrati se na taj blok, pa opet na rečenicu.',
    preset: { view: 'puno', translation: false, speed: 1, loop: true, pause: 1 },
  },
}
const NEXT_PHASE = { A: 'B', B: 'C', C: 'D' } as const

const D_QUESTIONS = [
  'Jesi li cijelu rečenicu izgovorio uz Nanami na 1× bez zastajanja?',
  'Jesi li ostao unutar jednog sloga iza nje?',
  'Znaš li bez gledanja reći što rečenica znači?',
]

const btn = 'rounded-xl px-4 py-3 font-semibold'
const primary = `${btn} bg-red-700 text-white active:bg-red-800`
const secondary = `${btn} bg-stone-200 text-stone-800 active:bg-stone-300`

function YesNo({ question, onAnswer }: { question: string; onAnswer: (ok: boolean) => void }) {
  return (
    <div className="mt-4 rounded-2xl bg-amber-50 p-4">
      <p className="font-semibold">{question}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => onAnswer(true)} className={`${btn} bg-emerald-600 text-white active:bg-emerald-700`}>
          Da
        </button>
        <button onClick={() => onAnswer(false)} className={`${btn} bg-stone-700 text-white active:bg-stone-800`}>
          Ne
        </button>
      </div>
    </div>
  )
}

function SentenceBox({ r, label }: { r: SentenceRef; label?: string }) {
  return (
    <div className="mt-3 rounded-2xl bg-stone-100 p-4">
      <p className="text-xs text-stone-500">
        {label ? `${label} · ` : ''}
        <span lang="ja">{titleOf(r.storyId)}</span>, rečenica {r.index + 1}
      </p>
      <p className="mt-1 text-xl" lang="ja">
        {sentenceJa(r.storyId, r.index)}
      </p>
    </div>
  )
}

const Note = ({ children }: { children: ReactNode }) => <p className="mt-3 text-stone-600">{children}</p>
const Done = ({ children }: { children: ReactNode }) => (
  <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900">{children}</p>
)

function Countdown({ startedAt, minutes }: { startedAt: number; minutes: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const left = Math.round(minutes * 60 - (now - startedAt) / 1000)
  const abs = Math.abs(left)
  const text = `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
  return left >= 0 ? (
    <span className="font-mono text-lg text-stone-600">⏱ {text}</span>
  ) : (
    <span className="rounded-lg bg-amber-100 px-2 py-1 text-sm text-amber-900">Vrijeme je isteklo · završi i potvrdi</span>
  )
}

// --- Korak 1: ponavljanje riječi ---
function WordsStep({ date, progress, setProgress }: Ctx) {
  const words = useLiveQuery(() => db.myWords.toArray())
  const reviews = useLiveQuery(() => db.wordReviews.toArray())
  const [revealed, setRevealed] = useState(false)
  // Popis se složi jednom na početku koraka, da se ne mijenja dok odgovaraš.
  useEffect(() => {
    if (!progress.wordIds && words && reviews) {
      void setProgress({ wordIds: wordsForReview(words, reviews, date).map((w) => w.id), item: 0 })
    }
  }, [progress.wordIds, words, reviews, date, setProgress])
  if (!words || !reviews || !progress.wordIds) return null
  const list = progress.wordIds.map((wid) => words.find((w) => w.id === wid)).filter((w) => !!w)
  const item = progress.item ?? 0
  if (!list.length) return <Note>U ⭐ Moje riječi još nema riječi. Ovaj korak danas preskoči (dodaj riječi u koraku Nove riječi).</Note>
  if (item >= list.length) return <Done>Sve riječi za danas su ponovljene ({list.length}).</Done>
  const w = list[item]
  async function answer(ok: boolean) {
    await db.wordReviews.put(afterWordReview(reviews!.find((r) => r.id === w.id), w.id, ok, date))
    setRevealed(false)
    await setProgress({ item: item + 1 })
  }
  return (
    <>
      <Note>Poslušaj i reci značenje naglas, pa dodirni karticu za provjeru.</Note>
      <p className="mt-2 text-sm text-stone-400">
        Riječ {item + 1} / {list.length}
      </p>
      <button onClick={() => setRevealed(true)} className="mt-2 w-full rounded-2xl bg-white p-6 text-center shadow-sm">
        <span className="block text-4xl" lang="ja">
          {w.word}
        </span>
        {w.reading !== w.word && (
          <span className="mt-1 block text-lg text-stone-500" lang="ja">
            {w.reading}
          </span>
        )}
        <span className="mt-4 block text-lg">{revealed ? w.hr || '(bez prijevoda)' : 'Dodirni za značenje'}</span>
      </button>
      <button onClick={() => void speak(w.reading)} className={`${secondary} mt-3 w-full`}>
        🔊 Poslušaj
      </button>
      {revealed && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button onClick={() => void answer(true)} className={`${btn} bg-emerald-600 text-white active:bg-emerald-700`}>
            Znao sam
          </button>
          <button onClick={() => void answer(false)} className={`${btn} bg-stone-700 text-white active:bg-stone-800`}>
            Nisam
          </button>
        </div>
      )}
    </>
  )
}

// --- Korak 2 i 4: jedna rečenica, jedno pitanje ---
function QuestionStep({
  ctx,
  refs,
  empty,
  instruction,
  question,
  preset,
  onAnswer,
}: {
  ctx: Ctx
  refs: SentenceRef[]
  empty: string
  instruction: string
  question: string
  preset: StoryPreset
  onAnswer: (s: SentenceState, ok: boolean) => SentenceState
}) {
  const item = ctx.progress.item ?? 0
  if (!refs.length) return <Note>{empty}</Note>
  if (item >= refs.length) return <Done>Gotovo: {refs.length} rečenica.</Done>
  const r = refs[item]
  async function answer(ok: boolean) {
    const s = ctx.sentences.find((x) => x.id === id(r))
    if (s) await db.sentences.put(onAnswer(s, ok))
    await ctx.setProgress({ item: item + 1 })
  }
  return (
    <>
      <Note>{instruction}</Note>
      <SentenceBox r={r} label={`${item + 1} / ${refs.length}`} />
      <button
        onClick={() => ctx.open({ kind: 'story', storyId: r.storyId, preset: { ...preset, index: r.index, note: instruction } })}
        className={`${primary} mt-3 w-full`}
      >
        ▶ Otvori rečenicu
      </button>
      <YesNo question={question} onAnswer={(ok) => void answer(ok)} />
    </>
  )
}

// --- Korak 3: nove rečenice (faze A–D) i dorada ---
function SentencesStep({ ctx, rework }: { ctx: Ctx; rework: boolean }) {
  const { plan, day, date, progress, setProgress, sentences } = ctx
  const extra = day.extra ?? []
  const queue: (SentenceRef & { again?: boolean })[] = rework
    ? plan.rework.map((r) => ({ ...r, again: true }))
    : [...plan.rework.map((r) => ({ ...r, again: true })), ...plan.newSentences, ...extra]
  const item = progress.item ?? 0
  const sentOf = (r: SentenceRef) => sentences.find((s) => s.id === id(r))

  if (progress.stopped) {
    return (
      <Done>
        Rečenica ni drugi put nije prošla fazu D. Sutra je prva nova, a danas se ne uzima nijedna druga. Potvrdi korak i idi
        dalje.
      </Done>
    )
  }

  if (item >= queue.length) {
    // Treća rečenica: obje nove prošle D unutar prvih 15 min koraka, a pravilo to dopušta.
    const story = stories.find((s) => s.id === plan.storyId)
    const taken = new Set(queue.map(id))
    const third = story?.sentences
      .map((_, index) => ({ storyId: plan.storyId, index }))
      .find((r) => !taken.has(id(r)) && (sentOf(r)?.status ?? 'nova') === 'nova')
    const offer =
      !rework && progress.fastPass && plan.canOfferThird && !extra.length && plan.newSentences.length === VODIC.newPerDay && third
    if (!queue.length) return <Note>Danas nema rečenica za ovaj korak. Potvrdi korak i idi dalje.</Note>
    return (
      <>
        <Done>Sve rečenice za danas su prošle fazu D. Sutra idu na Čisto test.</Done>
        {offer && (
          <div className="mt-4 rounded-2xl bg-sky-50 p-4">
            <p>Obje nove rečenice prošle su fazu D unutar 15 minuta. Želiš li treću?</p>
            <button
              onClick={() => void db.days.update(date, { extra: [third] })}
              className={`${primary} mt-3 w-full`}
            >
              ➕ Uzmi treću rečenicu
            </button>
          </div>
        )}
      </>
    )
  }

  const r = queue[item]
  const isThird = extra.some((x) => id(x) === id(r))
  const phase = progress.phase ?? (r.again ? 'D' : 'A')
  const dTries = progress.dTries ?? 0
  const info = PHASES[phase]
  const label = r.again ? 'dorada' : isThird ? 'treća' : 'nova'

  async function next(p: DayProgress) {
    await setProgress({ item: item + 1, phase: undefined, dTries: 0, asking: false, q: 0, ...p })
  }

  async function answer(ok: boolean) {
    const q = progress.q ?? 0
    if (ok && q < D_QUESTIONS.length - 1) return setProgress({ q: q + 1 })
    if (ok) {
      // Sva tri "Da": faza D prošla.
      await db.sentences.put(afterDPassed(sentOf(r), r, date))
      if (isThird && dTries === 0) await db.vodic.put(afterThird(ctx.state, true, date))
      const fresh = plan.newSentences.every((n) => id(n) === id(r) || sentOf(n)?.dPassedOn === date)
      const fast = !!day.stepStartedAt && Date.now() - day.stepStartedAt <= VODIC.third.withinMinutes * 60_000
      return next(plan.newSentences.some((n) => id(n) === id(r)) && fresh ? { fastPass: fast } : {})
    }
    if (isThird && dTries === 0) await db.vodic.put(afterThird(ctx.state, false, date))
    if (dTries === 0) {
      return setProgress({ phase: 'C', dTries: 1, asking: false, q: 0, result: 'Natrag na fazu C, pa još jedan krug faze D.' })
    }
    // Drugi put nije prošla.
    await db.sentences.put(afterDFailedTwice(sentOf(r), r))
    if (rework) return next({ result: 'Rečenica sutra ide prva.' })
    await setProgress({ stopped: true })
  }

  return (
    <>
      <SentenceBox r={r} label={`${label} ${item + 1} / ${queue.length}`} />
      {progress.result && <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">{progress.result}</p>}
      <p className="mt-4 font-semibold">{info.title}</p>
      <Note>{info.text}</Note>
      <button
        onClick={() =>
          ctx.open({ kind: 'story', storyId: r.storyId, preset: { ...info.preset, index: r.index, note: info.title } })
        }
        className={`${primary} mt-3 w-full`}
      >
        ▶ Otvori rečenicu
      </button>
      {phase !== 'D' ? (
        <button onClick={() => void setProgress({ phase: NEXT_PHASE[phase], result: undefined })} className={`${secondary} mt-3 w-full`}>
          Faza {phase} gotova → faza {NEXT_PHASE[phase]}
        </button>
      ) : !progress.asking ? (
        <button onClick={() => void setProgress({ asking: true, q: 0, result: undefined })} className={`${secondary} mt-3 w-full`}>
          Faza D gotova → pitanja
        </button>
      ) : (
        <YesNo question={`${(progress.q ?? 0) + 1}/3 · ${D_QUESTIONS[progress.q ?? 0]}`} onAnswer={(ok) => void answer(ok)} />
      )}
    </>
  )
}

// --- Subota: test cijele priče ---
function StoryTestStep({ ctx }: { ctx: Ctx }) {
  const { plan, progress, setProgress, date } = ctx
  const story = stories.find((s) => s.id === plan.storyId)
  if (!story) return null
  const n = story.sentences.length
  const item = progress.item ?? 0
  const failed = progress.failed ?? []
  if (progress.result) return <Done>{progress.result}</Done>
  const listening = item >= n
  const i = item % n
  async function answer(ok: boolean) {
    const f = ok || failed.includes(i) ? failed : [...failed, i]
    if (item + 1 < 2 * n) return setProgress({ item: item + 1, failed: f })
    const r = afterStoryTest(ctx.state, plan.storyId, f, ctx.sentences, date)
    await db.sentences.bulkPut(r.sentences)
    await db.vodic.put(r.state)
    await setProgress({
      failed: f,
      result: r.passed
        ? `Priča je gotova (neuspjelih: ${f.length}). Sljedeća priča iz reda počinje u ponedjeljak.`
        : `Neuspjelih rečenica: ${f.length}. One idu na doradu idućih dana, a nova priča čeka.`,
    })
  }
  return (
    <>
      <Note>
        {listening
          ? 'Sad pusti cijelu priču i slušaj bez gledanja u ekran. Zatim za svaku rečenicu odgovori.'
          : 'Pusti cijelu priču na 1× u Čistom načinu i govori uz Nanami. Zatim za svaku rečenicu odgovori.'}
      </Note>
      <button
        onClick={() =>
          ctx.open({
            kind: 'story',
            storyId: story.id,
            preset: { index: 0, view: listening ? 'sluh' : 'cisto', speed: 1, loop: false, note: 'Test priče: ▶ cijela priča' },
          })
        }
        className={`${primary} mt-3 w-full`}
      >
        ▶ Otvori priču
      </button>
      <SentenceBox r={{ storyId: story.id, index: i }} label={`${listening ? 'slušanje' : 'govor'} ${i + 1} / ${n}`} />
      <YesNo
        question={listening ? 'Razumio sam ovu rečenicu?' : 'Uz Nanami bez više od jednog zapinjanja?'}
        onAnswer={(ok) => void answer(ok)}
      />
    </>
  )
}

// --- Korak 7: čitanje (nedjeljom štoperica) ---
function ReadingStep({ ctx }: { ctx: Ctx }) {
  const { plan, day, date, sentences } = ctx
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [startedAt])
  const story = stories.find((s) => s.id === plan.storyId)
  const nextNew = story?.sentences.findIndex((_, i) => (sentences.find((s) => s.id === `${plan.storyId}:${i}`)?.status ?? 'nova') === 'nova')
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  const openStory = (index: number, note: string) =>
    ctx.open({ kind: 'story', storyId: plan.storyId, preset: { index, view: 'cisto', speed: 1, loop: false, note } })

  if (plan.kind === 'nedjelja') {
    const sec = startedAt ? Math.round((now - startedAt) / 1000) : 0
    return (
      <>
        <Note>Pročitaj naglas cijelu poznatu priču, bez zvuka. Štoperica mjeri vrijeme i sprema ga za tjedni izvještaj.</Note>
        <button onClick={() => openStory(0, 'Čitanje cijele priče naglas')} className={`${secondary} mt-3 w-full`}>
          Otvori priču u Čistom
        </button>
        <p className="mt-4 text-center font-mono text-4xl">{fmt(sec)}</p>
        {!startedAt ? (
          <button onClick={() => (setStartedAt(Date.now()), setNow(Date.now()))} className={`${primary} mt-3 w-full`}>
            ▶ Start štoperice
          </button>
        ) : (
          <button
            onClick={() => {
              void db.days.update(date, { readingSec: sec })
              setStartedAt(null)
            }}
            className={`${primary} mt-3 w-full`}
          >
            ■ Stop i spremi
          </button>
        )}
        {day.readingSec !== undefined && <Done>Spremljeno vrijeme: {fmt(day.readingSec)}</Done>}
      </>
    )
  }
  return (
    <>
      <Note>Tri dijela po 5 minuta. Čitaj naglas.</Note>
      <button
        onClick={() => openStory(nextNew !== undefined && nextNew >= 0 ? nextNew : 0, 'Hladno čitanje: čitaj naglas bez zvuka, pa ▶ za provjeru')}
        className={`${secondary} mt-3 w-full text-left`}
      >
        1. Hladno čitanje sutrašnjih rečenica
      </button>
      <button onClick={() => openStory(0, 'Brzo čitanje gotovih rečenica')} className={`${secondary} mt-3 w-full text-left`}>
        2. Brzo čitanje gotovih rečenica
      </button>
      <button onClick={() => ctx.open({ kind: 'moje' })} className={`${secondary} mt-3 w-full text-left`}>
        3. Riječi s pokrivenim romajijem (⭐ Moje riječi)
      </button>
    </>
  )
}

function StepBody({ ctx }: { ctx: Ctx }) {
  const { plan, day, date } = ctx
  const step = plan.steps[day.stepIndex ?? 0]
  switch (step.id) {
    case 'rijeci':
      return <WordsStep {...ctx} />
    case 'zagrijavanje':
      return (
        <QuestionStep
          ctx={ctx}
          refs={plan.warmup}
          empty="Danas nijedna gotova rečenica nema rok ponavljanja. Potvrdi korak i idi dalje."
          instruction="Shadowing uz Nanami na 1×, petlja na rečenici."
          question="Uz Nanami na 1× bez zastajanja?"
          preset={{ view: 'cisto', speed: 1, loop: true, pause: 1 }}
          onAnswer={(s, ok) => afterWarmup(s, ok, date)}
        />
      )
    case 'nove':
      return <SentencesStep ctx={ctx} rework={false} />
    case 'dorada':
      return <SentencesStep ctx={ctx} rework />
    case 'cisto':
      return (
        <QuestionStep
          ctx={ctx}
          refs={plan.cleanTest}
          empty="Nema rečenica za Čisto test (to su one koje su jučer prošle fazu D)."
          instruction="Pročitaj naglas bez furigane i bez zvuka, pa ▶ za usporedbu."
          question="Pročitao naglas bez zastajanja i bez furigane?"
          preset={{ view: 'cisto', speed: 1, loop: false }}
          onAnswer={(s, ok) => afterCleanTest(s, ok, date)}
        />
      )
    case 'konjugator': {
      const names = plan.konj.forms.length
        ? plan.konj.forms.map((f) => FORMS.find((x) => x.id === f)?.ending ?? f).join(', ')
        : 'svi oblici'
      const source = plan.konj.source === 'price' ? 'riječi iz priča' : 'svih 495 riječi'
      return (
        <>
          <Note>
            Red {plan.konj.row + 1}: {names} · {source}. Nakon svakog „Pokaži” odgovori Znao (točno i bez dugog razmišljanja) ili
            Nisam.
          </Note>
          <button
            onClick={() =>
              ctx.open({
                kind: 'konj',
                preset: { forms: plan.konj.forms, source: plan.konj.source, halfWeak: true, note: `Red ${plan.konj.row + 1}: ${names}` },
              })
            }
            className={`${primary} mt-3 w-full`}
          >
            ▶ Otvori konjugator
          </button>
          {ctx.progress.result && <Done>{ctx.progress.result}</Done>}
        </>
      )
    }
    case 'nove-rijeci': {
      const story = stories.find((s) => s.id === plan.storyId)
      const priority = [...new Set(story?.sentences.flatMap((s) => s.words.map((w) => w.lemma)) ?? [])]
      return (
        <>
          <Note>Otvara se 🎯 Sljedećih 8 (prvo riječi iz tekuće priče). Za svaku: poslušaj, ponovi naglas 3×, pa ☆.</Note>
          <button
            onClick={() =>
              ctx.open({ kind: 'vocab', preset: { next8: true, priority, note: 'Za svaku riječ: poslušaj, ponovi 3×, pa ☆.' } })
            }
            className={`${primary} mt-3 w-full`}
          >
            ▶ Otvori Sljedećih 8
          </button>
        </>
      )
    }
    case 'citanje':
      return <ReadingStep ctx={ctx} />
    case 'test-price':
      return <StoryTestStep ctx={ctx} />
  }
}

function Finished({ date }: { date: string }) {
  const [text, setText] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  async function copyReport() {
    const report = weeklyReport({
      date,
      state: (await db.vodic.get('stanje')) ?? initialState(),
      storyTitle: titleOf,
      sentenceText: sentenceJa,
      sentences: await db.sentences.toArray(),
      days: await db.days.toArray(),
      attempts: await db.conjAttempts.toArray(),
      myWordsCount: await db.myWords.count(),
      reviews: await db.wordReviews.toArray(),
    })
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
    } catch {
      setText(report) // kopiranje nije dopušteno: tekst se prikaže pa ga označiš sam
    }
  }
  return (
    <>
      <Done>🎉 Današnji trening je gotov. Vidimo se sutra!</Done>
      <button onClick={() => void copyReport()} className={`${secondary} mt-4 w-full`}>
        📋 Kopiraj tjedni izvještaj
      </button>
      {copied && <p className="mt-2 text-center text-sm text-emerald-700">Kopirano. Zalijepi ga u razgovor s Claudeom.</p>}
      {text && <textarea readOnly value={text} rows={14} className="mt-3 w-full rounded-xl border p-2 text-sm" />}
    </>
  )
}

export default function Training({ short, onBack }: { short: boolean; onBack: () => void }) {
  const [date] = useState(today)
  const [tool, setTool] = useState<Tool | null>(null)
  const data = useLiveQuery(
    async () => ({
      day: await db.days.get(date),
      state: (await db.vodic.get('stanje')) ?? initialState(),
      sentences: await db.sentences.toArray(),
    }),
    [date],
  )

  // Prvo otvaranje danas: plan se zamrzne u dnevniku dana, da se ne mijenja tijekom dana.
  useEffect(() => {
    void db.transaction('rw', db.days, db.vodic, db.sentences, async () => {
      const existing = await db.days.get(date)
      if (existing?.plan) return
      const state = (await db.vodic.get('stanje')) ?? initialState()
      const plan = planDay({ date, state, sentences: await db.sentences.toArray(), days: await db.days.toArray(), stories: STORY_INFO, short })
      await db.vodic.put(state)
      await db.days.put({
        ...(existing ?? { date, v: 1, done: [] }),
        short,
        steps: plan.steps.map((s) => s.id),
        plan,
        stepIndex: 0,
        stepStartedAt: Date.now(),
        progress: {},
      })
    })
  }, [date, short])

  if (!data?.day?.plan) return <p className="p-6 text-center text-stone-400">Slažem današnji trening…</p>
  const { day, state, sentences } = data
  const plan = day.plan as Plan
  const stepIndex = day.stepIndex ?? 0
  const progress = day.progress ?? {}
  const setProgress = (p: DayProgress) => db.days.update(date, { progress: { ...progress, ...p } })

  async function closeTool() {
    const was = tool
    setTool(null)
    // Nakon konjugatora: provjeri prelazi li se na idući red tablice.
    if (was?.kind === 'konj') {
      const fresh = (await db.vodic.get('stanje')) ?? initialState()
      const next = konjugatorAdvance(fresh, await db.conjAttempts.toArray())
      if (next.konjRow !== fresh.konjRow) {
        await db.vodic.put(next)
        await setProgress({ result: `Dvije sesije zaredom s 9/10: od sutra konjugator prelazi na red ${next.konjRow + 1}.` })
      }
    }
  }

  if (tool) {
    if (tool.kind === 'story') {
      const story = stories.find((s) => s.id === tool.storyId)!
      return <StoryPlayer key={JSON.stringify(tool.preset)} story={story} preset={tool.preset} onBack={() => void closeTool()} />
    }
    return (
      <Suspense fallback={<p className="p-6 text-center text-stone-400">Učitavam…</p>}>
        {tool.kind === 'konj' && <Conjugator preset={tool.preset} onBack={() => void closeTool()} />}
        {tool.kind === 'vocab' && <Vocabulary preset={tool.preset} onBack={() => void closeTool()} />}
        {tool.kind === 'moje' && <MyWords onBack={() => void closeTool()} />}
      </Suspense>
    )
  }

  const finished = stepIndex >= plan.steps.length
  const step = plan.steps[Math.min(stepIndex, plan.steps.length - 1)]
  const ctx: Ctx = { date, plan, day, state, sentences, progress, setProgress, open: setTool }

  async function endStep(markDone: boolean) {
    await db.days.update(date, {
      done: markDone && !day.done.includes(step.id) ? [...day.done, step.id] : day.done,
      stepIndex: stepIndex + 1,
      stepStartedAt: Date.now(),
      progress: {},
    })
    window.scrollTo(0, 0)
  }

  return (
    <main className="min-h-dvh bg-stone-50 p-6 pb-40 text-stone-900">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
          ← Početna
        </button>
        {!finished && day.stepStartedAt && <Countdown key={stepIndex} startedAt={day.stepStartedAt} minutes={step.minutes} />}
      </div>

      {/* Napredak kroz korake */}
      <div className="mt-3 flex gap-1">
        {plan.steps.map((s, i) => (
          <span
            key={s.id}
            className={`h-2 flex-1 rounded-full ${i < stepIndex ? 'bg-emerald-500' : i === stepIndex ? 'bg-red-700' : 'bg-stone-200'}`}
          />
        ))}
      </div>

      {finished ? (
        <Finished date={date} />
      ) : (
        <>
          <p className="mt-4 text-sm text-stone-500">
            Korak {stepIndex + 1} / {plan.steps.length} · {step.minutes} min
          </p>
          <h1 className="text-2xl font-semibold">{STEP_TITLE[step.id]}</h1>
          {step.id === 'nove' && plan.rework.length > 0 && (
            <p className="text-sm text-stone-500" lang="ja">
              Prvo dorada: {listOf(plan.rework)}
            </p>
          )}
          <StepBody ctx={ctx} />
        </>
      )}

      {!finished && (
        <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2 bg-stone-50/95 p-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <button onClick={() => void endStep(true)} className={`${btn} w-full bg-emerald-600 py-4 text-lg text-white active:bg-emerald-700`}>
            ✓ Korak gotov
          </button>
          <button onClick={() => void endStep(false)} className="text-sm text-stone-500">
            Preskoči korak
          </button>
        </div>
      )}
    </main>
  )
}

// ===================== Kratka sesija =====================
// Svaka sesija je za sebe: blokovi koje je složio sastavljač (vodic-plan.ts, planSession), jedan za drugim.
// Veza s drugim sesijama su samo FSRS kartice (cards.ts): svaka ocjena Znao / Nisam odmah se sprema.

type SCtx = {
  log: SessionLog
  progress: SessionProgress
  setProgress: (p: SessionProgress) => Promise<unknown>
  open: (t: Tool) => void
  minutes: number // trajanje tekućeg bloka
}

// Je li vrijeme tekućeg bloka isteklo (poziva se iz dodira, ne pri crtanju).
const blockTimeUp = (log: SessionLog, minutes: number) => Date.now() > (log.blockStartedAt ?? log.startedAt) + minutes * 60_000

// "kyushu-001:3" → { storyId, index }
const refOf = (ref: string): SentenceRef => ({ storyId: ref.slice(0, ref.lastIndexOf(':')), index: Number(ref.slice(ref.lastIndexOf(':') + 1)) })

// Tri kruga (Nova rečenica i Priča): svaki skida jednu pomoć.
const ROUNDS: { title: string; preset: StoryPreset }[] = [
  { title: 'Upoznaj rečenicu', preset: { view: 'rendgen', translation: true, speed: 0.85, loop: false } },
  { title: 'Krug 1: sporo, s tekstom (0.7×)', preset: { view: 'puno', translation: true, speed: 0.7, loop: true, pause: 1 } },
  { title: 'Krug 2: normalno, s tekstom (1×)', preset: { view: 'puno', translation: false, speed: 1, loop: true, pause: 1 } },
  { title: 'Krug 3: normalno, bez teksta (1×)', preset: { view: 'sluh', translation: false, speed: 1, loop: true, pause: 1 } },
]
const SENTENCE_TEXT = [
  'Pročitaj prijevod, u 🔍 Rendgenu dodirni riječi koje ne znaš, pa jednom poslušaj rečenicu.',
  'Petlja je uključena. Prvi krug samo slušaj, zatim ponavljaj naglas u stanci, 3–4 puta.',
  'Ponavljaj u stanci, a zadnja 2–3 puta govori istovremeno s Nanami.',
  'Tekst je skriven. Govori uz Nanami, pola sloga iza nje. Dodirni rečenicu ako moraš provjeriti.',
]

// --- Blok Riječi ---
function WordBlock({ s }: { s: SCtx }) {
  const { log, progress, setProgress } = s
  const data = useLiveQuery(async () => ({
    cards: await db.cards.toArray(),
    logs: await db.cardLogs.toArray(),
    words: await db.myWords.toArray(),
  }))
  // Popis se složi jednom na početku bloka, da se ne mijenja dok odgovaraš.
  useEffect(() => {
    if (data && !progress.queue) void setProgress({ queue: wordQueue(data.cards, data.words, data.logs, Date.now()), item: 0 })
  }, [data, progress.queue, setProgress])
  if (!data || !progress.queue) return null
  const list = progress.queue
  const item = progress.item ?? 0
  if (!list.length) return <Done>Nema riječi na redu ni novih za danas. Dodirni „Blok gotov”.</Done>
  if (item >= list.length) return <Done>Sve riječi na redu su ponovljene ({list.length}). Dodirni „Blok gotov”.</Done>
  if (progress.timeUp) return <Done>Vrijeme bloka je isteklo. Ponovljeno: {item} od {list.length}. Dodirni „Blok gotov”.</Done>
  const ref = list[item]
  const [word, reading] = ref.split('|')
  const hr = data.words.find((w) => w.id === ref)?.hr
  const isNew = !data.cards.some((c) => c.id === cardId('rijec', ref))
  async function answer(ok: boolean) {
    await saveRating('rijec', ref, ok, log.id)
    await setProgress({ item: item + 1, shown: false, timeUp: blockTimeUp(log, s.minutes) })
  }
  return (
    <>
      <Note>Poslušaj i reci značenje naglas, pa dodirni Pokaži.</Note>
      <p className="mt-2 text-sm text-stone-400">
        Riječ {item + 1} / {list.length}
        {isNew && ' · nova'}
      </p>
      <div className="mt-2 rounded-2xl bg-white p-6 text-center shadow-sm">
        <span className="block text-4xl" lang="ja">
          {word}
        </span>
        {reading !== word && (
          <span className="mt-1 block text-lg text-stone-500" lang="ja">
            {reading}
          </span>
        )}
        {progress.shown && <span className="mt-4 block text-lg">{hr || '(bez prijevoda)'}</span>}
      </div>
      {progress.shown && <ContextSentence key={`${ref}-${item}`} lemma={word} />}
      <button onClick={() => void speak(reading)} className={`${secondary} mt-3 w-full`}>
        🔊 Poslušaj
      </button>
      {!progress.shown ? (
        <button onClick={() => void setProgress({ shown: true })} className={`${primary} mt-3 w-full`}>
          Pokaži
        </button>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button onClick={() => void answer(true)} className={`${btn} bg-emerald-600 text-white active:bg-emerald-700`}>
            Znao
          </button>
          <button onClick={() => void answer(false)} className={`${btn} bg-stone-700 text-white active:bg-stone-800`}>
            Nisam
          </button>
        </div>
      )}
    </>
  )
}

// --- Blok Fraze: rečenice kojima je rok ---
function PhraseBlock({ s }: { s: SCtx }) {
  const { log, progress, setProgress } = s
  const cards = useLiveQuery(() => db.cards.toArray())
  useEffect(() => {
    if (cards && !progress.queue) void setProgress({ queue: dueCards(cards, 'fraza', Date.now()).map((c) => c.ref), item: 0 })
  }, [cards, progress.queue, setProgress])
  if (!cards || !progress.queue) return null
  const list = progress.queue
  const item = progress.item ?? 0
  if (!list.length) return <Done>Nema fraza na redu. Dodirni „Blok gotov”.</Done>
  if (item >= list.length) return <Done>Sve fraze na redu su ponovljene ({list.length}). Dodirni „Blok gotov”.</Done>
  if (progress.timeUp) return <Done>Vrijeme bloka je isteklo. Ponovljeno: {item} od {list.length}. Dodirni „Blok gotov”.</Done>
  const ref = list[item]
  const r = refOf(ref)
  const instruction = 'Shadowing uz Nanami na 1×, petlja na rečenici.'
  async function answer(ok: boolean) {
    await saveRating('fraza', ref, ok, log.id)
    await setProgress({ item: item + 1, timeUp: blockTimeUp(log, s.minutes) })
  }
  return (
    <>
      <Note>{instruction}</Note>
      <SentenceBox r={r} label={`${item + 1} / ${list.length}`} />
      <button
        onClick={() =>
          s.open({ kind: 'story', storyId: r.storyId, preset: { view: 'puno', speed: 1, loop: true, pause: 1, index: r.index, note: instruction } })
        }
        className={`${primary} mt-3 w-full`}
      >
        ▶ Otvori rečenicu
      </button>
      <YesNo question="Uz Nanami na 1× bez zastajanja?" onAnswer={(ok) => void answer(ok)} />
    </>
  )
}

// --- Blok Nova rečenica: upoznaj, tri kruga, tri pitanja → nova kartica ---
function NewSentenceBlock({ s }: { s: SCtx }) {
  const { log, progress, setProgress } = s
  const cards = useLiveQuery(() => db.cards.toArray())
  useEffect(() => {
    if (!cards || progress.queue) return
    const next = currentStory(cards, STORY_INFO).newSentence
    void setProgress({ queue: next ? [`${next.storyId}:${next.index}`] : [], round: 0, q: 0 })
  }, [cards, progress.queue, setProgress])
  if (!cards || !progress.queue) return null
  if (!progress.queue.length) return <Done>Sve rečenice iz priča već učiš. Dodirni „Blok gotov”.</Done>
  const ref = progress.queue[0]
  const r = refOf(ref)
  const round = progress.round ?? 0
  if (progress.result) return <Done>{progress.result}</Done>

  async function answer(ok: boolean) {
    const q = progress.q ?? 0
    if (ok && q < D_QUESTIONS.length - 1) return setProgress({ q: q + 1 })
    const card = await saveRating('fraza', ref, ok, log.id)
    const when = formatWhen(card.due, card.last_review ?? card.due)
    await setProgress({
      result: ok
        ? `Rečenica je dobila karticu. Ponovit ćeš je ${when} u bloku Fraze.`
        : `Nije još sjela, i to je u redu. Vraća se ${when} u bloku Fraze.`,
    })
  }

  return (
    <>
      <SentenceBox r={r} label="nova" />
      {round < ROUNDS.length ? (
        <>
          <p className="mt-4 font-semibold">{ROUNDS[round].title}</p>
          <Note>{SENTENCE_TEXT[round]}</Note>
          <button
            onClick={() =>
              s.open({ kind: 'story', storyId: r.storyId, preset: { ...ROUNDS[round].preset, index: r.index, note: ROUNDS[round].title } })
            }
            className={`${primary} mt-3 w-full`}
          >
            ▶ Otvori rečenicu
          </button>
          <button onClick={() => void setProgress({ round: round + 1 })} className={`${secondary} mt-3 w-full`}>
            {round < ROUNDS.length - 1 ? `Gotovo → ${ROUNDS[round + 1].title.split(':')[0]}` : 'Gotovo → pitanja'}
          </button>
        </>
      ) : (
        <YesNo question={`${(progress.q ?? 0) + 1}/3 · ${D_QUESTIONS[progress.q ?? 0]}`} onAnswer={(ok) => void answer(ok)} />
      )}
    </>
  )
}

// --- Blok Priča: cijela tekuća priča u tri kruga ---
function StoryBlock({ s }: { s: SCtx }) {
  const { log, progress, setProgress } = s
  const round = Math.max(1, progress.round ?? 1)
  if (round > 3) return <Done>Sva tri kruga su gotova. Dodirni „Blok gotov”.</Done>
  const r = ROUNDS[round]
  return (
    <>
      <p className="mt-3 text-stone-500" lang="ja">
        {titleOf(log.storyId)}
      </p>
      <p className="mt-2 font-semibold">{r.title}</p>
      <Note>
        Dodirni ▶ Cijela priča od ove rečenice i govori uz Nanami.
        {round === 3 ? ' Tekst je skriven; dodirni rečenicu samo ako moraš provjeriti.' : ''}
      </Note>
      <button
        onClick={() => s.open({ kind: 'story', storyId: log.storyId, preset: { ...r.preset, loop: false, index: 0, note: r.title } })}
        className={`${primary} mt-3 w-full`}
      >
        ▶ Otvori priču
      </button>
      <button onClick={() => void setProgress({ round: round + 1 })} className={`${secondary} mt-3 w-full`}>
        {round < 3 ? `Krug ${round} gotov → krug ${round + 1}` : 'Krug 3 gotov'}
      </button>
    </>
  )
}

// --- Blokovi koji otvaraju postojeće alate ---
function KonjBlock({ s }: { s: SCtx }) {
  const state = useLiveQuery(async () => (await db.vodic.get('stanje')) ?? initialState())
  if (!state) return null
  const forms = rowForms(state.konjRow)
  const names = forms.length ? forms.map((f) => FORMS.find((x) => x.id === f)?.ending ?? f).join(', ') : 'svi oblici'
  return (
    <>
      <Note>
        Red {state.konjRow + 1}: {names}. Pola zadataka je iz tvojih slabih točaka. Nakon svakog „Pokaži” odgovori Znao (točno i
        bez dugog razmišljanja) ili Nisam.
      </Note>
      <button
        onClick={() => s.open({ kind: 'konj', preset: { forms, source: 'sve', halfWeak: true, note: `Red ${state.konjRow + 1}: ${names}` } })}
        className={`${primary} mt-3 w-full`}
      >
        ▶ Otvori konjugator
      </button>
      {s.progress.result && <Done>{s.progress.result}</Done>}
    </>
  )
}

function ReadingBlock({ s }: { s: SCtx }) {
  const note = 'Čitaj naglas rečenice koje već učiš, bez zvuka. Nakon svake ▶ za provjeru.'
  return (
    <>
      <Note>{note} Ako zapneš, pročitaj rečenicu još jednom.</Note>
      <button
        onClick={() => s.open({ kind: 'story', storyId: s.log.storyId, preset: { index: 0, view: 'cisto', speed: 1, loop: false, note } })}
        className={`${primary} mt-3 w-full`}
      >
        ▶ Otvori priču u Čistom
      </button>
    </>
  )
}

function NewWordsBlock({ s }: { s: SCtx }) {
  const story = stories.find((x) => x.id === s.log.storyId)
  const priority = [...new Set(story?.sentences.flatMap((x) => x.words.map((w) => w.lemma)) ?? [])]
  return (
    <>
      <Note>Otvara se 🎯 Sljedećih 8 (prvo riječi iz tekuće priče). Za svaku: poslušaj, ponovi naglas 3×, pa ☆. Riječi zatim dolaze u blok Riječi.</Note>
      <button
        onClick={() => s.open({ kind: 'vocab', preset: { next8: true, priority, note: 'Za svaku riječ: poslušaj, ponovi 3×, pa ☆.' } })}
        className={`${primary} mt-3 w-full`}
      >
        ▶ Otvori Sljedećih 8
      </button>
    </>
  )
}

function BlockBody({ id, s }: { id: BlockId; s: SCtx }) {
  switch (id) {
    case 'rijeci':
      return <WordBlock s={s} />
    case 'fraze':
      return <PhraseBlock s={s} />
    case 'nova-recenica':
      return <NewSentenceBlock s={s} />
    case 'prica':
      return <StoryBlock s={s} />
    case 'konjugator':
      return <KonjBlock s={s} />
    case 'citanje':
      return <ReadingBlock s={s} />
    case 'nove-rijeci':
      return <NewWordsBlock s={s} />
  }
}

// Preostalo vrijeme cijele sesije (malo, uz vrijeme bloka).
function SessionClock({ log }: { log: SessionLog }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const left = Math.round(log.minutes * 60 - (now - log.startedAt) / 1000)
  const abs = Math.abs(left)
  return (
    <span className="text-sm text-stone-500">
      sesija {left < 0 ? '+' : ''}
      {Math.floor(abs / 60)}:{String(abs % 60).padStart(2, '0')}
    </span>
  )
}

// --- Sažetak na kraju sesije ---
function SessionSummary({ log, onBack }: { log: SessionLog; onBack: () => void }) {
  const data = useLiveQuery(async () => ({
    logs: await db.cardLogs.where('at').aboveOrEqual(log.startedAt).toArray(),
    cards: await db.cards.toArray(),
    sessions: await db.sessionLogs.toArray(),
    now: Date.now(),
  }))
  if (!data) return null
  const sum = sessionSummary(log.id, data.logs, data.cards, data.now)
  const stats = sessionStats(data.sessions, data.now)
  const goal = Number(readSetting('sesija-cilj')) || SESIJA.defaultGoal
  const took = Math.round(((log.endedAt ?? data.now) - log.startedAt) / 60_000)
  const line = (label: string, done: number, fresh: number) =>
    done + fresh > 0 && (
      <p>
        {label}: {done > 0 && `ponovljeno ${done}`}
        {done > 0 && fresh > 0 && ', '}
        {fresh > 0 && `novih ${fresh}`}
      </p>
    )
  return (
    <>
      <Done>
        🎉 Sesija je gotova ({took} min). Ovo ti je {stats.todayCount}. sesija danas.
      </Done>
      <div className="mt-4 flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-semibold">Odrađeno</p>
        {log.blocks.map((b) => (
          <p key={b} className="text-stone-600">
            {BLOCK_TITLE[b as BlockId] ?? b}
          </p>
        ))}
        {line('Riječi', sum.words, sum.newWords)}
        {line('Fraze', sum.fraze, sum.newFraze)}
      </div>
      <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-semibold">Iduće ponavljanje</p>
        <p className="text-stone-600">
          {sum.nextDue === undefined
            ? 'Još nema kartica za ponavljanje.'
            : sum.nextDue <= data.now
              ? 'Neke kartice su već na redu, idu u iduću sesiju.'
              : `${formatWhen(sum.nextDue, data.now)} (${sum.nextCount} ${sum.nextCount === 1 ? 'kartica' : sum.nextCount <= 4 ? 'kartice' : 'kartica'})`}
        </p>
      </div>
      <div className="mt-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <p>
          <span className="inline-block w-16 text-stone-500">Danas:</span>
          <span className={`font-semibold ${stats.todayCount >= goal ? 'text-emerald-700' : ''}`}>
            {stats.todayCount} / {goal}
          </span>
          <span className="text-stone-500"> · {formatMinutes(stats.todayMinutes)}</span>
          {stats.todayCount >= goal && ' ✓ dnevni cilj'}
        </p>
        <p>
          <span className="inline-block w-16 text-stone-500">Ukupno:</span>
          <span className="font-semibold">{stats.totalCount}</span>
          <span className="text-stone-500"> · {formatMinutes(stats.totalMinutes)}</span>
        </p>
      </div>
      <button onClick={onBack} className={`${primary} mt-4 w-full py-4 text-lg`}>
        ← Početna
      </button>
    </>
  )
}

function ToolView({ tool, onBack }: { tool: Tool; onBack: () => void }) {
  if (tool.kind === 'story') {
    const story = stories.find((s) => s.id === tool.storyId)!
    return <StoryPlayer key={JSON.stringify(tool.preset)} story={story} preset={tool.preset} onBack={onBack} />
  }
  return (
    <Suspense fallback={<p className="p-6 text-center text-stone-400">Učitavam…</p>}>
      {tool.kind === 'konj' && <Conjugator preset={tool.preset} onBack={onBack} />}
      {tool.kind === 'vocab' && <Vocabulary preset={tool.preset} onBack={onBack} />}
      {tool.kind === 'moje' && <MyWords onBack={onBack} />}
    </Suspense>
  )
}

export function SessionRun({ id: sessionId, onBack }: { id: string; onBack: () => void }) {
  const [tool, setTool] = useState<Tool | null>(null)
  const log = useLiveQuery(() => db.sessionLogs.get(sessionId), [sessionId])
  const blockIndex = log?.blockIndex ?? 0
  const finished = !!log && blockIndex >= log.blocks.length
  // Sesija se broji kad stigneš do sažetka.
  useEffect(() => {
    if (log && finished && log.endedAt === undefined) void db.sessionLogs.update(log.id, { endedAt: Date.now() })
  }, [log, finished])

  if (!log) return <p className="p-6 text-center text-stone-400">Učitavam sesiju…</p>
  const progress = log.progress ?? {}
  const setProgress = (p: SessionProgress) => db.sessionLogs.update(sessionId, { progress: { ...progress, ...p } })

  async function closeTool() {
    const was = tool
    setTool(null)
    // Nakon konjugatora: provjeri prelazi li se na idući red tablice.
    if (was?.kind === 'konj') {
      const fresh = (await db.vodic.get('stanje')) ?? initialState()
      const next = konjugatorAdvance(fresh, await db.conjAttempts.toArray())
      if (next.konjRow !== fresh.konjRow) {
        await db.vodic.put(next)
        await setProgress({ result: `Dvije sesije zaredom s 9/10: konjugator prelazi na red ${next.konjRow + 1}.` })
      }
    }
  }
  if (tool) return <ToolView tool={tool} onBack={() => void closeTool()} />

  const block = log.blocks[Math.min(blockIndex, log.blocks.length - 1)] as BlockId
  const minutes = SESIJA.blocks[block] ?? 5
  const s: SCtx = { log, progress, setProgress, open: setTool, minutes }

  async function endBlock() {
    await db.sessionLogs.update(sessionId, { blockIndex: blockIndex + 1, blockStartedAt: Date.now(), progress: {} })
    window.scrollTo(0, 0)
  }

  return (
    <main className="min-h-dvh bg-stone-50 p-6 pb-40 text-stone-900">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
          ← Početna
        </button>
        {!finished && (
          <span className="flex flex-col items-end">
            <Countdown key={blockIndex} startedAt={log.blockStartedAt ?? log.startedAt} minutes={minutes} />
            {log.blocks.length > 1 && <SessionClock log={log} />}
          </span>
        )}
      </div>

      {/* Napredak kroz blokove */}
      <div className="mt-3 flex gap-1">
        {log.blocks.map((b, i) => (
          <span
            key={b}
            style={{ flexGrow: SESIJA.blocks[b as BlockId] ?? 5 }}
            className={`h-2 rounded-full ${i < blockIndex ? 'bg-emerald-500' : i === blockIndex && !finished ? 'bg-red-700' : 'bg-stone-200'}`}
          />
        ))}
      </div>

      {finished ? (
        <SessionSummary log={log} onBack={onBack} />
      ) : (
        <>
          <p className="mt-4 text-sm text-stone-500">
            Blok {blockIndex + 1} / {log.blocks.length} · {minutes} min
          </p>
          <h1 className="text-2xl font-semibold">{BLOCK_TITLE[block]}</h1>
          <BlockBody key={blockIndex} id={block} s={s} />
        </>
      )}

      {!finished && (
        <div className="fixed inset-x-0 bottom-0 bg-stone-50/95 p-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <button onClick={() => void endBlock()} className={`${btn} w-full bg-emerald-600 py-4 text-lg text-white active:bg-emerald-700`}>
            {blockIndex < log.blocks.length - 1 ? '✓ Blok gotov' : '✓ Blok gotov → sažetak'}
          </button>
        </div>
      )}
    </main>
  )
}
