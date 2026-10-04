// Početni zaslon: "Današnji trening" (dorada 1V). Zasad pregled plana koji složi planer (vodic-plan.ts).
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { FORMS } from './conjugate'
import { db } from './db'
import { VODIC, type StepId } from './vodic-config'
import { initialState, planDay, today, type Plan } from './vodic-plan'
import { nextTopic, unlearnedLeft } from './vodic-rules'
import { listOf, STEP_TITLE, STORY_INFO, titleOf } from './vodic-text'
import { stories } from './stories'

const DAY_NAMES = ['', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota', 'nedjelja']

// Kratki opis što korak danas sadrži.
function detail(id: StepId, plan: Plan): string {
  switch (id) {
    case 'nove':
      return listOf(plan.newSentences) + (plan.rework.length ? ` (+ dorada: ${listOf(plan.rework)})` : '')
    case 'dorada':
      return plan.rework.length ? listOf(plan.rework) : 'nema rečenica u radu'
    case 'zagrijavanje':
      return plan.warmup.length ? listOf(plan.warmup) : 'danas nema rokova ponavljanja'
    case 'cisto':
      return plan.cleanTest.length ? listOf(plan.cleanTest) : 'nema rečenica za test'
    case 'konjugator': {
      const names = plan.konj.forms.length
        ? plan.konj.forms.map((f) => FORMS.find((x) => x.id === f)?.ending ?? f).join(', ')
        : 'svi oblici'
      return `${names} · ${plan.konj.source === 'price' ? 'riječi iz priča' : 'svih 495 riječi'}`
    }
    case 'test-price':
      return titleOf(plan.storyId)
    default:
      return ''
  }
}

export default function TodayPlan({ onStart }: { onStart: (short: boolean) => void }) {
  const [short, setShort] = useState(false)
  const date = today()
  const data = useLiveQuery(async () => ({
    state: (await db.vodic.get('stanje')) ?? initialState(),
    sentences: await db.sentences.toArray(),
    days: await db.days.toArray(),
  }))
  if (!data) return null

  // Ako je današnji trening već pokrenut, prikazuje se zamrznuti plan.
  const day = data.days.find((d) => d.date === date)
  const started = day?.plan as Plan | undefined
  const plan = started ?? planDay({ date, ...data, stories: STORY_INFO, short })
  const stepIndex = day?.stepIndex ?? 0
  const finished = !!started && stepIndex >= plan.steps.length
  const dow = new Date(plan.date + 'T12:00:00').getDay() || 7
  const left = unlearnedLeft(data.state, STORY_INFO, data.sentences)
  const topic = nextTopic(stories.length)

  // "Kreni danas": vodič počinje danas umjesto u ponedjeljak (prvi dan je uvijek običan dan).
  async function startToday() {
    await db.vodic.put({ ...data!.state, startDate: date, storyStartedOn: date })
    onStart(false)
  }

  return (
    <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xl font-semibold">🧭 Današnji trening ({plan.totalMinutes} min)</p>
      {plan.kind === 'prije-pocetka' && (
        <p className="mt-1 text-sm text-amber-800">
          Vodič kreće u ponedjeljak {plan.date.slice(8, 10)}. {plan.date.slice(5, 7)}. Ovo je plan za taj dan. Možeš i početi danas.
        </p>
      )}
      {plan.kind === 'povratak' && (
        <p className="mt-1 text-sm text-amber-800">
          Nakon {plan.missedDays} dana pauze: danas samo ponavljanje, bez novih rečenica.
        </p>
      )}
      {(plan.kind === 'subota' || plan.kind === 'nedjelja') && (
        <p className="mt-1 text-sm text-stone-500">
          {plan.kind === 'subota' ? 'Subota: test priče.' : 'Nedjelja: samo ponavljanje.'} ({DAY_NAMES[dow]})
        </p>
      )}

      <ol className="mt-3 flex flex-col gap-2">
        {plan.steps.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            <span className="w-6 shrink-0 text-right text-stone-400">{started && i < stepIndex ? '✓' : `${i + 1}.`}</span>
            <span className={`min-w-0 flex-1 ${started && i < stepIndex ? 'text-stone-400' : ''}`}>
              <span className="font-semibold">{STEP_TITLE[s.id]}</span>
              {detail(s.id, plan) && (
                <span className="block text-sm text-stone-500" lang="ja">
                  {detail(s.id, plan)}
                </span>
              )}
            </span>
            <span className="shrink-0 text-sm text-stone-500">{s.minutes} min</span>
          </li>
        ))}
      </ol>

      {plan.kind === 'prije-pocetka' ? (
        <button onClick={() => void startToday()} className="mt-4 w-full rounded-xl bg-red-700 py-3 text-lg font-semibold text-white active:bg-red-800">
          ▶ Kreni danas
        </button>
      ) : finished ? (
        <button onClick={() => onStart(false)} className="mt-4 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white">
          ✓ Današnji trening je gotov
        </button>
      ) : (
        <button
          onClick={() => onStart(short)}
          className="mt-4 w-full rounded-xl bg-red-700 py-3 text-lg font-semibold text-white active:bg-red-800"
        >
          {started ? `▶ Nastavi (korak ${stepIndex + 1}/${plan.steps.length})` : '▶ Kreni'}
        </button>
      )}
      {!started && plan.kind !== 'prije-pocetka' && (
        <button
          onClick={() => setShort(!short)}
          aria-pressed={short}
          className={`mt-2 w-full rounded-xl py-2 text-sm font-semibold ${
            short ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-700'
          }`}
        >
          {short ? '✕ Natrag na puni plan' : 'Imam samo 20 min'}
        </button>
      )}

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
