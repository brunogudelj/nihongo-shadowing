// Početni zaslon: "Današnji trening" (dorada 1V). Zasad pregled plana koji složi planer (vodic-plan.ts).
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { FORMS } from './conjugate'
import { db } from './db'
import { stories } from './stories'
import type { StepId } from './vodic-config'
import { initialState, planDay, today, type Plan, type SentenceRef } from './vodic-plan'

const STEP_TITLE: Record<StepId, string> = {
  rijeci: 'Ponavljanje riječi',
  zagrijavanje: 'Zagrijavanje',
  nove: 'Nove rečenice',
  cisto: 'Čisto test',
  konjugator: 'Konjugator',
  'nove-rijeci': 'Nove riječi',
  citanje: 'Čitanje',
  dorada: 'Dorada rečenica u radu',
  'test-price': 'Test cijele priče',
}

const DAY_NAMES = ['', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota', 'nedjelja']

const titleOf = (id: string) => stories.find((s) => s.id === id)?.title_ja ?? id
const listOf = (refs: SentenceRef[]) => {
  if (!refs.length) return ''
  const groups = new Map<string, number[]>()
  for (const r of refs) groups.set(r.storyId, [...(groups.get(r.storyId) ?? []), r.index + 1])
  return [...groups].map(([sid, xs]) => `${titleOf(sid)} ${xs.join(', ')}`).join(' · ')
}

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

export default function TodayPlan() {
  const [short, setShort] = useState(false)
  const data = useLiveQuery(async () => ({
    state: (await db.vodic.get('stanje')) ?? initialState(),
    sentences: await db.sentences.toArray(),
    days: await db.days.toArray(),
  }))
  if (!data) return null

  const plan = planDay({
    date: today(),
    ...data,
    stories: stories.map((s) => ({ id: s.id, sentenceCount: s.sentences.length })),
    short,
  })
  const dow = new Date(plan.date + 'T12:00:00').getDay() || 7

  return (
    <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xl font-semibold">🧭 Današnji trening ({plan.totalMinutes} min)</p>
      {plan.kind === 'prije-pocetka' && (
        <p className="mt-1 text-sm text-amber-800">
          Vodič kreće u ponedjeljak {plan.date.slice(8, 10)}. {plan.date.slice(5, 7)}. Ovo je plan za taj dan.
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
            <span className="w-6 shrink-0 text-right text-stone-400">{i + 1}.</span>
            <span className="min-w-0 flex-1">
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

      <button
        onClick={() => setShort(!short)}
        aria-pressed={short}
        className={`mt-4 w-full rounded-xl py-2 text-sm font-semibold ${
          short ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-700'
        }`}
      >
        {short ? '✕ Natrag na puni plan' : 'Imam samo 20 min'}
      </button>
      <p className="mt-2 text-center text-xs text-stone-400">Pokretanje koraka dolazi uskoro (vodič, dio 1V-b).</p>
    </section>
  )
}
