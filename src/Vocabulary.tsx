import { useMemo, useState } from 'react'
import allWords from '../data/rijeci.json'
import { KanjiMagnifier, KanjiText } from './Kanji'
import { toRomaji } from './romaji'
import { speak } from './speech'

type Entry = { word: string; reading: string; level: string; pos: string; hr: string }

// Romaji se računa jednom, za pretraživanje i prikaz.
const WORDS = (allWords as Entry[]).map((w) => ({ ...w, romaji: toRomaji(w.reading) }))

const LEVELS = ['N5', 'N4'] as const

export default function Vocabulary({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('')
  const [levels, setLevels] = useState<string[]>([...LEVELS])
  const [playing, setPlaying] = useState<string>()

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return WORDS.filter(
      (w) =>
        levels.includes(w.level) &&
        (!q || w.word.includes(q) || w.reading.includes(q) || w.romaji.includes(q) || w.hr.toLowerCase().includes(q)),
    )
  }, [query, levels])

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
              ← Priče
            </button>
            <p className="text-sm text-stone-400">{shown.length} riječi</p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
            <p className="ml-auto self-center text-xs text-stone-400">Dodirni riječ da je čuješ.</p>
          </div>
        </header>

        <ul className="flex flex-col gap-2">
          {shown.map((w) => {
            const id = w.word + w.reading
            return (
              <li key={id}>
                <button
                  onClick={() => play(w)}
                  className={`flex w-full items-baseline gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm active:bg-stone-100 ${
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
                  <span className="text-xs text-stone-400">{w.level}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </main>
    </KanjiMagnifier>
  )
}
