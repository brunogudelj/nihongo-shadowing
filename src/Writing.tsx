import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import plan from '../data/pisanje-plan.json'
import { db } from './db'
import { speak } from './speech'
import { hasSound, letterGroups, parts, sayable } from './writing-speech'

// Stranica "Pisanje": plan pisanja kane na papiru (21 dan). Aplikacija samo prikazuje što se piše;
// ništa se ne crta ni tipka.

type Rijec = { kana: string; kanji: string | null; hr: string; vjezba?: boolean; pazi?: string }
type Oblik = { glagol: string; znacenje: string; oblici: (string | null)[] }
type Par = { hr: string; ja: string; dan?: number }
type Dan = {
  dan: number
  tjedan: number
  naslov: string
  tablicaNapamet: { pismo: string; opis: string; slova: string } | null
  novaSlova: string | null
  rijeci: Rijec[]
  oblici: { stupci: string[]; redovi: Oblik[] } | null
  diktat: Par[] | null
  recenice: Par[] | null
  napomena: string | null
  upute: string[] | null
}

const DANI = plan.dani as Dan[]
const TJEDNI = ['Hiragana', 'Katakana', 'Oblici i ponavljanje']

export default function Writing({ onBack }: { onBack: () => void }) {
  const [dan, setDan] = useState<number>()
  const doneRows = useLiveQuery(() => db.writingDays.toArray(), [])
  const done = new Set((doneRows ?? []).map((r) => r.dan))
  const next = DANI.find((x) => !done.has(x.dan))?.dan
  const d = DANI.find((x) => x.dan === dan)
  if (d) return <DayView key={d.dan} d={d} done={done.has(d.dan)} onBack={() => setDan(undefined)} onOpen={setDan} />

  return (
    <main className="min-h-dvh bg-stone-50 p-6 text-stone-900">
      <header className="mb-4 flex items-center justify-between">
        <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
          ← Natrag
        </button>
        <p className="text-sm text-stone-400">30 min dnevno, na papiru</p>
      </header>
      <h1 className="mb-1 text-2xl font-semibold">✍️ Pisanje kane</h1>
      <p className="mb-4 text-stone-500">
        Gotovo {done.size} / {DANI.length} dana
      </p>
      {next !== undefined && (
        <button
          onClick={() => setDan(next)}
          className="mb-6 w-full rounded-2xl bg-stone-800 p-4 text-left text-white active:bg-stone-900"
        >
          <p className="text-lg font-semibold">▶ {done.size ? 'Nastavi' : 'Kreni'}: dan {next}</p>
          <p lang="ja" className="text-stone-300">
            {DANI[next - 1].naslov}
          </p>
        </button>
      )}
      {[1, 2, 3].map((t) => (
        <section key={t} className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-stone-500">
            {t}. tjedan: {TJEDNI[t - 1]}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 landscape:grid-cols-2">
            {DANI.filter((x) => x.tjedan === t).map((x) => (
              <button
                key={x.dan}
                onClick={() => setDan(x.dan)}
                className={`flex items-baseline gap-3 rounded-2xl px-4 py-3 text-left shadow-sm active:bg-stone-100 ${
                  done.has(x.dan) ? 'bg-stone-100 text-stone-500' : 'bg-white'
                } ${x.dan === next ? 'ring-2 ring-stone-800' : ''}`}
              >
                <span className="w-14 shrink-0 text-stone-400">Dan {x.dan}</span>
                <span lang="ja" className="flex-1 text-lg font-medium">
                  {x.naslov}
                </span>
                {done.has(x.dan) && <span className="text-green-700">✓</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

// ---------- Zaslon jednog dana: korak po korak ----------

type StepId = 'tablica' | 'nova' | 'rijeci' | 'oblici' | 'diktat' | 'recenice'
type Step = { id: StepId; naziv: string; opis: string; minuta: number }

const KORAK = Object.fromEntries(plan.koraci.map((k) => [k.id, k])) as Record<string, (typeof plan.koraci)[number]>

// Koraci dana i njihove minute (ukupno oko 30). Korak postoji samo ako dan ima taj sadržaj.
function stepsOf(d: Dan): Step[] {
  const imaRijeci = d.rijeci.length > 0
  const s: Step[] = []
  const add = (id: StepId, minuta: number, naziv = KORAK[id]?.naziv, opis = KORAK[id]?.opis) =>
    s.push({ id, naziv: naziv ?? id, opis: opis ?? '', minuta })
  const zadnji = d.upute !== null // dan 21: velika provjera
  if (d.tablicaNapamet) add('tablica', zadnji ? 8 : 5)
  if (d.novaSlova) add('nova', 5)
  if (imaRijeci) add('rijeci', 12)
  if (d.oblici) add('oblici', imaRijeci ? 4 : 17)
  if (d.diktat || imaRijeci)
    add('diktat', zadnji ? 14 : imaRijeci ? 4 : 8, 'Diktat', d.diktat ? 'Gledaš samo hrvatski i pišeš japanski. Dodirni redak da otkriješ rješenje.' : undefined)
  if (d.recenice)
    add('recenice', zadnji ? 5 : 25, 'Rečenice', 'Gledaš hrvatsku rečenicu i pišeš je na japanskom, s razmacima. Dodirni da otkriješ.')
  return s
}

// Gumb koji na dodir izgovori tekst.
function Say({ text, className = '', children }: { text: string; className?: string; children?: React.ReactNode }) {
  const [on, setOn] = useState(false)
  if (!hasSound(text)) return <span className={className}>{children ?? text}</span>
  return (
    <button
      lang="ja"
      onClick={async () => {
        setOn(true)
        await speak(sayable(text))
        setTimeout(() => setOn(false), 400)
      }}
      className={`rounded-lg active:bg-stone-200 ${on ? 'bg-amber-100' : ''} ${className}`}
    >
      {children ?? text}
    </button>
  )
}

// Skriveno rješenje: dodir ga otkrije (i izgovori); kad je otkriveno, dodir ga izgovori.
function Hidden({ text, shown, onShow, className = '' }: { text: string; shown: boolean; onShow: () => void; className?: string }) {
  if (shown)
    return (
      <span className={`inline-flex flex-wrap gap-x-2 ${className}`}>
        {parts(text).map((p, i) => (
          <Say key={i} text={p} className="px-1" />
        ))}
      </span>
    )
  return (
    <button
      onClick={() => {
        onShow()
        const first = parts(text)[0]
        if (first && hasSound(first)) void speak(sayable(first))
      }}
      className={`min-w-16 rounded-lg border-2 border-dashed border-stone-300 px-3 text-stone-300 active:bg-stone-100 ${className}`}
      aria-label="Otkrij"
    >
      ?
    </button>
  )
}

function Letters({ text, big }: { text: string; big?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-2xl bg-white p-4 shadow-sm">
      {letterGroups(text).map((g, i) => (
        <span key={i} className="flex gap-1">
          {g.map((l, j) => (
            <Say key={j} text={l} className={`${big ? 'min-w-14 text-5xl' : 'min-w-10 text-3xl'} px-1 py-1 text-center`} />
          ))}
        </span>
      ))}
    </div>
  )
}

function DayView({ d, done, onBack, onOpen }: { d: Dan; done: boolean; onBack: () => void; onOpen: (n: number) => void }) {
  const steps = stepsOf(d)
  const [i, setI] = useState(0)
  const [shown, setShown] = useState<Set<string>>(new Set())
  const [all, setAll] = useState(false)
  const step = steps[i]
  const go = (n: number) => {
    setI(n)
    setShown(new Set())
    setAll(false)
    window.scrollTo(0, 0)
  }
  const isShown = (k: string) => all || shown.has(k)
  const show = (k: string) => setShown((s) => new Set(s).add(k))
  const prev = DANI.find((x) => x.dan === d.dan - 1)
  const odJucer = prev ? [1, 5, 9].map((n) => prev.rijeci[n]).filter(Boolean) : []
  const canHide = step.id !== 'rijeci' && step.id !== 'nova'
  const finish = async () => {
    await db.writingDays.put({ dan: d.dan, doneAt: Date.now() })
    onBack()
  }

  return (
    <main className="flex min-h-dvh flex-col bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-10 bg-stone-50 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
            ← Dani
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
            Dan {d.dan}: <span lang="ja">{d.naslov}</span>
          </h1>
          {done && (
            <button
              onClick={() => void db.writingDays.delete(d.dan)}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm text-green-700 active:bg-stone-200"
              title="Dodirni da poništiš"
            >
              ✓ gotovo · poništi
            </button>
          )}
        </div>
        <nav className="mt-2 flex gap-2 overflow-x-auto">
          {steps.map((s, n) => (
            <button
              key={s.id}
              onClick={() => go(n)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                n === i ? 'bg-stone-800 text-white' : n < i ? 'bg-stone-200 text-stone-600' : 'bg-white text-stone-500 shadow-sm'
              }`}
            >
              {n + 1}. {s.naziv} · {s.minuta} min
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 px-4 pb-24">
        {i === 0 && d.napomena && <p className="mb-4 rounded-2xl bg-amber-50 p-4 text-stone-700">{d.napomena}</p>}
        {i === 0 && d.upute && (
          <ol className="mb-4 list-decimal rounded-2xl bg-white p-4 pl-8 text-stone-700 shadow-sm">
            {d.upute.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ol>
        )}

        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-stone-600">{step.opis}</p>
          {canHide && (
            <button onClick={() => setAll(!all)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm text-stone-600 shadow-sm active:bg-stone-100">
              {step.id === 'tablica' ? (all ? 'Sakrij' : 'Provjeri') : all ? 'Sakrij sve' : 'Otkrij sve'}
            </button>
          )}
        </div>

        {step.id === 'tablica' && d.tablicaNapamet && (
          <>
            <p className="mb-3 text-lg">
              Napiši bez gledanja: <b>{d.tablicaNapamet.opis}</b>
            </p>
            {all && <Letters text={d.tablicaNapamet.slova} />}
          </>
        )}

        {step.id === 'nova' && d.novaSlova && <Letters text={d.novaSlova} big />}

        {step.id === 'rijeci' && (
          <table className="w-full overflow-hidden rounded-2xl bg-white shadow-sm">
            <tbody>
              {d.rijeci.map((r) => (
                <tr key={r.kana} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-x-2">
                      {parts(r.kana).map((p, n) => (
                        <Say key={n} text={p} className="px-1 text-2xl font-medium" />
                      ))}
                    </span>
                  </td>
                  <td lang="ja" className="px-2 py-2 text-lg text-stone-500">
                    {r.kanji}
                  </td>
                  <td className="px-3 py-2 text-stone-700">
                    {r.hr}
                    {r.vjezba && <span className="ml-2 rounded bg-stone-100 px-1.5 text-xs text-stone-500">vježba</span>}
                    {r.pazi && <span className="block text-sm text-red-700">pazi: {r.pazi}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {step.id === 'oblici' && d.oblici && (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="border-b border-stone-200 text-left text-sm text-stone-400">
                  <th className="px-3 py-2 font-normal">glagol</th>
                  {d.oblici.stupci.map((s) => (
                    <th key={s} lang="ja" className="px-2 py-2 font-normal">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.oblici.redovi.map((r, ri) => (
                  <tr key={r.glagol} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-2">
                      <Say text={r.glagol} className="px-1 text-xl font-medium" />
                      <span className="block px-1 text-sm text-stone-500">{r.znacenje}</span>
                    </td>
                    {r.oblici.map((o, ci) => (
                      <td key={ci} className="px-2 py-2 text-xl">
                        {o === null ? (
                          <span className="text-stone-300">—</span>
                        ) : (
                          <Hidden text={o} shown={isShown(`o${ri}-${ci}`)} onShow={() => show(`o${ri}-${ci}`)} className="py-1" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {step.id === 'diktat' &&
          (d.diktat ? (
            <PairList items={d.diktat} isShown={isShown} show={show} prefix="d" />
          ) : (
            <>
              <PairList items={d.rijeci.map((r) => ({ hr: r.hr, ja: r.kana }))} isShown={isShown} show={show} prefix="d" />
              {odJucer.length > 0 && (
                <>
                  <h2 className="mt-5 mb-2 font-semibold">Od jučer</h2>
                  <PairList items={odJucer.map((r) => ({ hr: r.hr, ja: r.kana }))} isShown={isShown} show={show} prefix="j" />
                </>
              )}
            </>
          ))}

        {step.id === 'recenice' && d.recenice && <PairList items={d.recenice} isShown={isShown} show={show} prefix="r" />}
      </div>

      <footer className="fixed inset-x-0 bottom-0 flex items-center gap-2 border-t border-stone-200 bg-stone-50/95 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => go(i - 1)}
          disabled={i === 0}
          className="rounded-full px-4 py-2 text-stone-600 active:bg-stone-200 disabled:text-stone-300"
        >
          ‹ Natrag
        </button>
        <p className="flex-1 text-center text-sm text-stone-400">
          {i + 1} / {steps.length}
        </p>
        {i < steps.length - 1 ? (
          <button onClick={() => go(i + 1)} className="rounded-full bg-stone-800 px-5 py-2 text-white active:bg-stone-900">
            Dalje ›
          </button>
        ) : done ? (
          d.dan < DANI.length && (
            <button onClick={() => onOpen(d.dan + 1)} className="rounded-full bg-stone-800 px-5 py-2 text-white active:bg-stone-900">
              Dan {d.dan + 1} ›
            </button>
          )
        ) : (
          <button onClick={() => void finish()} className="rounded-full bg-green-700 px-5 py-2 text-white active:bg-green-800">
            Gotovo ✓
          </button>
        )}
      </footer>
    </main>
  )
}

function PairList({ items, isShown, show, prefix }: { items: Par[]; isShown: (k: string) => boolean; show: (k: string) => void; prefix: string }) {
  return (
    <ol className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {items.map((p, n) => {
        const k = `${prefix}${n}`
        return (
          <li key={k} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-stone-100 px-4 py-2 last:border-0">
            <span className="text-lg text-stone-700">
              {n + 1}. {p.hr}
            </span>
            <Hidden text={p.ja} shown={isShown(k)} onShow={() => show(k)} className="py-1 text-xl" />
          </li>
        )
      })}
    </ol>
  )
}
