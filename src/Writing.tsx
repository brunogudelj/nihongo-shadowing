import { useState } from 'react'
import plan from '../data/pisanje-plan.json'

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

export const DANI = plan.dani as Dan[]
const TJEDNI = ['Hiragana', 'Katakana', 'Oblici i ponavljanje']

export default function Writing({ onBack }: { onBack: () => void }) {
  const [dan, setDan] = useState<number>()
  const d = DANI.find((x) => x.dan === dan)
  if (d) return <DayView d={d} onBack={() => setDan(undefined)} onOpen={setDan} />

  return (
    <main className="min-h-dvh bg-stone-50 p-6 text-stone-900">
      <header className="mb-4 flex items-center justify-between">
        <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
          ← Natrag
        </button>
        <p className="text-sm text-stone-400">30 min dnevno, na papiru</p>
      </header>
      <h1 className="mb-4 text-2xl font-semibold">✍️ Pisanje kane</h1>
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
                className="flex items-baseline gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm active:bg-stone-100"
              >
                <span className="w-14 shrink-0 text-stone-400">Dan {x.dan}</span>
                <span lang="ja" className="text-lg font-medium">
                  {x.naslov}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

function Section({ title, minutes, children }: { title: string; minutes?: number; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-baseline justify-between text-lg font-semibold">
        <span>{title}</span>
        {minutes !== undefined && <span className="text-sm font-normal text-stone-400">{minutes} min</span>}
      </h2>
      {children}
    </section>
  )
}

function DayView({ d, onBack, onOpen }: { d: Dan; onBack: () => void; onOpen: (n: number) => void }) {
  const imaRijeci = d.rijeci.length > 0
  return (
    <main className="min-h-dvh bg-stone-50 p-6 text-stone-900">
      <header className="mb-4 flex items-center justify-between">
        <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
          ← Dani
        </button>
        <div className="flex gap-1">
          {d.dan > 1 && (
            <button onClick={() => onOpen(d.dan - 1)} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
              ‹ {d.dan - 1}
            </button>
          )}
          {d.dan < DANI.length && (
            <button onClick={() => onOpen(d.dan + 1)} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
              {d.dan + 1} ›
            </button>
          )}
        </div>
      </header>
      <h1 className="mb-1 text-2xl font-semibold">
        Dan {d.dan}: <span lang="ja">{d.naslov}</span>
      </h1>
      <p className="mb-5 text-sm text-stone-400">
        {d.tjedan}. tjedan: {TJEDNI[d.tjedan - 1]}
      </p>

      {d.napomena && <p className="mb-6 rounded-2xl bg-amber-50 p-4 text-stone-700">{d.napomena}</p>}

      {d.upute && (
        <Section title="Danas">
          <ol className="list-decimal pl-6 text-stone-700">
            {d.upute.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ol>
        </Section>
      )}

      {d.tablicaNapamet && (
        <Section title="Tablica napamet" minutes={5}>
          <p className="mb-2 text-stone-700">Napiši bez gledanja: {d.tablicaNapamet.opis}</p>
          <p lang="ja" className="rounded-2xl bg-white p-4 text-2xl leading-relaxed tracking-wider shadow-sm">
            {d.tablicaNapamet.slova}
          </p>
        </Section>
      )}

      {d.novaSlova && (
        <Section title="Nova slova" minutes={5}>
          <p lang="ja" className="rounded-2xl bg-white p-4 text-4xl leading-relaxed tracking-wider shadow-sm">
            {d.novaSlova}
          </p>
        </Section>
      )}

      {imaRijeci && (
        <Section title="Riječi dana" minutes={12}>
          <table className="w-full overflow-hidden rounded-2xl bg-white shadow-sm">
            <tbody>
              {d.rijeci.map((r) => (
                <tr key={r.kana} className="border-b border-stone-100 last:border-0">
                  <td lang="ja" className="px-4 py-2 text-2xl font-medium">
                    {r.kana}
                  </td>
                  <td lang="ja" className="px-2 py-2 text-lg text-stone-500">
                    {r.kanji}
                  </td>
                  <td className="px-4 py-2 text-stone-700">
                    {r.hr}
                    {r.vjezba && <span className="ml-2 rounded bg-stone-100 px-1.5 text-xs text-stone-500">vježba</span>}
                    {r.pazi && <span className="block text-sm text-red-700">pazi: {r.pazi}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {d.oblici && (
        <Section title="Oblici" minutes={imaRijeci ? 4 : 17}>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="border-b border-stone-200 text-left text-sm text-stone-400">
                  <th className="px-4 py-2 font-normal">glagol</th>
                  {d.oblici.stupci.map((s) => (
                    <th key={s} lang="ja" className="px-3 py-2 font-normal">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.oblici.redovi.map((r) => (
                  <tr key={r.glagol} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2">
                      <span lang="ja" className="text-xl font-medium">
                        {r.glagol}
                      </span>
                      <span className="block text-sm text-stone-500">{r.znacenje}</span>
                    </td>
                    {r.oblici.map((o, i) => (
                      <td key={i} lang="ja" className="px-3 py-2 text-xl">
                        {o ?? <span className="text-stone-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {(d.diktat || imaRijeci) && (
        <Section title="Mini diktat" minutes={imaRijeci ? 4 : 8}>
          {d.diktat ? (
            <PairList items={d.diktat} />
          ) : (
            <p className="text-stone-700">Pokrij kanu i iz hrvatskog napiši 6 današnjih riječi i 3 od jučer.</p>
          )}
        </Section>
      )}

      {d.recenice && (
        <Section title="Rečenice">
          <PairList items={d.recenice} />
        </Section>
      )}
    </main>
  )
}

function PairList({ items }: { items: Par[] }) {
  return (
    <ol className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {items.map((p, i) => (
        <li key={i} className="flex flex-col border-b border-stone-100 px-4 py-2 last:border-0">
          <span className="text-stone-700">
            {i + 1}. {p.hr}
          </span>
          <span lang="ja" className="text-xl">
            {p.ja}
          </span>
        </li>
      ))}
    </ol>
  )
}
