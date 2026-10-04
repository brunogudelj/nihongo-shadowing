import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { addMyWord, db, wordId } from './db'
import allWords from '../data/rijeci.json'
import AddWord from './AddWord'
import { KanjiMagnifier, KanjiText } from './Kanji'
import { toRomaji } from './romaji'
import { speak } from './speech'

type Entry = { word: string; reading: string; level: string; pos: string; hr: string; mine?: boolean }

// Romaji se računa jednom, za pretraživanje i prikaz.
const WORDS = (allWords as Entry[]).map((w) => ({ ...w, romaji: toRomaji(w.reading) }))

const LEVELS = ['N5', 'N4'] as const

// Vodič otvara popis s 🎯 Sljedećih 8, s prednošću riječima iz tekuće priče (`priority` = osnovni oblici).
export type VocabPreset = { next8: true; priority: string[]; note?: string }

export default function Vocabulary({ onBack, preset }: { onBack: () => void; preset?: VocabPreset }) {
  const [query, setQuery] = useState('')
  const [levels, setLevels] = useState<string[]>([...LEVELS])
  const [playing, setPlaying] = useState<string>()
  // "Sljedećih 8": prvih 8 riječi (N5 pa N4) koje još nisu u mojim riječima. Popis se zamrzne
  // dok ga ne zatvoriš, da riječi ne nestaju dok ih označavaš.
  const [batch, setBatch] = useState<string[] | null>(null)

  async function nextEight() {
    const mine = new Set(await db.myWords.toCollection().primaryKeys())
    const priority = new Set(preset?.priority ?? [])
    // Prvo riječi iz tekuće priče (ako ih vodič zada), pa N5, pa N4.
    const order = (w: (typeof WORDS)[number]) => (priority.has(w.word) ? 0 : w.level === 'N5' ? 1 : 2)
    const next = WORDS.filter((w) => levels.includes(w.level) && !mine.has(wordId(w.word, w.reading)))
      .sort((a, b) => order(a) - order(b))
      .slice(0, 8)
    setBatch(next.map((w) => w.word + w.reading))
    setQuery('')
  }

  // Vodič: odmah otvori Sljedećih 8.
  useEffect(() => {
    if (preset?.next8) void nextEight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addAll() {
    for (const w of WORDS.filter((w) => batch?.includes(w.word + w.reading))) {
      await addMyWord({ word: w.word, reading: w.reading, hr: w.hr, source: 'rijeci' })
    }
  }

  // Ručno upisane riječi (iz ⭐ Moje riječi) dolaze na vrh, s oznakom "moja".
  const own = useLiveQuery(() => db.myWords.filter((w) => w.source === 'rucno').toArray(), [])

  const shown = useMemo(() => {
    if (batch) return WORDS.filter((w) => batch.includes(w.word + w.reading))
    const mine = (own ?? []).map((w) => ({
      word: w.word,
      reading: w.reading,
      hr: w.hr,
      level: 'moja',
      pos: '',
      mine: true,
      romaji: toRomaji(w.reading),
    }))
    const q = query.trim().toLowerCase()
    return [...mine, ...WORDS].filter(
      (w) =>
        (w.mine || levels.includes(w.level)) &&
        (!q || w.word.includes(q) || w.reading.includes(q) || w.romaji.includes(q) || w.hr.toLowerCase().includes(q)),
    )
  }, [query, levels, batch, own])

  async function play(w: (typeof WORDS)[number]) {
    setPlaying(w.word + w.reading)
    await speak(w.reading)
    setPlaying(undefined)
  }

  return (
    <KanjiMagnifier>
      <main className="min-h-dvh bg-stone-50 p-6 text-stone-900">
        <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-6 -mt-6 flex flex-col gap-3 bg-stone-50 px-6 pt-6 pb-3">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
              {preset ? '← Vodič' : '← Natrag'}
            </button>
            <p className="text-sm text-stone-400">{shown.length} riječi</p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setBatch(null)
            }}
            placeholder="Traži: japanski, romaji ili hrvatski"
            className="w-full rounded-2xl bg-white px-4 py-3 text-lg shadow-sm outline-none"
          />
          <div className="flex gap-2">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLevels(levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l])}
                aria-pressed={levels.includes(l)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  levels.includes(l) ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-500'
                }`}
              >
                {l}
              </button>
            ))}
            <button
              onClick={() => (batch ? setBatch(null) : nextEight())}
              aria-pressed={!!batch}
              className={`ml-auto rounded-full px-4 py-1.5 text-sm font-semibold ${
                batch ? 'bg-amber-400 text-stone-900' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {batch ? '✕ Svi' : '🎯 Sljedećih 8'}
            </button>
          </div>
          {batch && (
            <div className="flex items-center gap-2 text-sm">
              <p className="flex-1 text-stone-500">
                {batch.length ? 'Poslušaj, ponovi naglas, pa ☆ (ili sve odjednom).' : 'Sve riječi su već u mojim riječima. 🎉'}
              </p>
              {batch.length > 0 && (
                <button onClick={addAll} className="rounded-full bg-amber-400 px-3 py-1.5 font-semibold text-stone-900">
                  ★ Dodaj svih {batch.length}
                </button>
              )}
            </div>
          )}
          {!batch && <p className="-mt-1 text-xs text-stone-400">Dodirni riječ da je čuješ.</p>}
          {preset?.note && <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">🧭 {preset.note}</p>}
        </header>

        <ul className="flex flex-col gap-2">
          {shown.map((w) => {
            const id = w.word + w.reading
            return (
              <li key={id} className="flex items-center gap-2">
                <button
                  onClick={() => play(w)}
                  className={`flex min-w-0 flex-1 items-baseline gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm active:bg-stone-100 ${
                    playing === id ? 'ring-2 ring-red-700' : ''
                  }`}
                >
                  <span lang="ja" className="text-2xl font-medium">
                    <KanjiText text={w.word} />
                  </span>
                  <span className="min-w-0 flex-1">
                    {w.reading !== w.word && (
                      <span lang="ja" className="text-stone-500">
                        {w.reading}{' '}
                      </span>
                    )}
                    <span className="text-sm text-stone-400 italic">{w.romaji}</span>
                    <span className="block text-stone-700">{w.hr}</span>
                  </span>
                  <span className={`text-xs ${w.mine ? 'rounded-full bg-amber-200 px-2 text-amber-900' : 'text-stone-400'}`}>
                    {w.level}
                  </span>
                </button>
                <AddWord word={w.word} reading={w.reading} hr={w.hr} source="rijeci" />
              </li>
            )
          })}
        </ul>
      </main>
    </KanjiMagnifier>
  )
}
