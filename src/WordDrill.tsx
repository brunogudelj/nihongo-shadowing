import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import allWords from '../data/rijeci.json'
import { db, wordId } from './db'
import { KanjiMagnifier, KanjiText } from './Kanji'
import { toRomaji } from './romaji'
import { readSetting, writeSetting } from './settings'
import { speak } from './speech'
import { stories } from './stories'
import { KONJUGATOR } from './vodic-config'

// Ponavljanje riječi: radi kao konjugator (Pokaži → Znao / Nisam, "Nisam" se vraća nakon ~5 riječi),
// ali vježba značenje riječi umjesto oblika.

type Entry = { word: string; reading: string; level?: string; hr: string }

const WORDS = allWords as Entry[]

// Riječi s popisa koje se pojavljuju u pričama (po osnovnom obliku).
const STORY_LEMMAS = new Set(stories.flatMap((s) => s.sentences.flatMap((x) => x.words.map((w) => w.lemma))))
const STORY_WORDS = WORDS.filter((w) => STORY_LEMMAS.has(w.word))

type Source = 'moje' | 'price' | 'sve'

function loadSource(): Source {
  const v = readSetting('rij-izvor')
  return v === 'moje' || v === 'price' || v === 'sve' ? v : 'moje'
}

const randomOf = <T,>(xs: T[]): T | null => (xs.length ? xs[Math.floor(Math.random() * xs.length)] : null)
const keyOf = (w: Entry) => wordId(w.word, w.reading)

export default function WordDrill({ onBack }: { onBack: () => void }) {
  const [source, setSource] = useState<Source>(loadSource)
  const [view, setView] = useState<'vjezba' | 'postavke'>('vjezba')
  const [revealed, setRevealed] = useState(false)
  const [session] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  const mine = useLiveQuery(() => db.myWords.toArray(), [])
  const myWords = useMemo((): Entry[] => {
    const level = new Map(WORDS.map((w) => [keyOf(w), w.level]))
    return (mine ?? []).map((w) => ({ word: w.word, reading: w.reading, hr: w.hr, level: level.get(w.id) }))
  }, [mine])

  const words = useMemo(
    () => (source === 'moje' ? myWords : source === 'price' ? STORY_WORDS : WORDS),
    [source, myWords],
  )

  // Riječ s "Nisam" vraća se nakon ~5 drugih riječi.
  const answered = useRef(0)
  const retries = useRef<{ word: Entry; due: number }[]>([])
  const [picked, setPicked] = useState<Entry | null>(null)
  // Dok riječ nije izričito odabrana (na početku ili nakon promjene izvora), uzme se jedna nasumična.
  const fallback = useMemo(() => randomOf(words), [words])
  const current = picked ?? fallback

  function next() {
    const dueIndex = retries.current.findIndex((r) => r.due <= answered.current)
    if (dueIndex >= 0) {
      setPicked(retries.current.splice(dueIndex, 1)[0].word)
    } else {
      // Ista riječ ne dolazi dvaput zaredom (osim ako je jedina).
      const others = words.filter((w) => !current || keyOf(w) !== keyOf(current))
      setPicked(randomOf(others.length ? others : words))
    }
    setRevealed(false)
  }

  async function record(result: 'znao' | 'nisam') {
    if (!current) return
    await db.wordAttempts.add({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      v: 1,
      at: Date.now(),
      word: current.word,
      reading: current.reading,
      direction: 'jp-hr',
      source: 'slobodno',
      session,
      result,
    })
    answered.current++
    if (result === 'nisam') retries.current.push({ word: current, due: answered.current + KONJUGATOR.retryAfter })
    next()
  }

  function chooseSource(v: Source) {
    setSource(v)
    writeSetting('rij-izvor', v)
    setPicked(null)
    setRevealed(false)
  }

  return (
    <KanjiMagnifier>
      <main className="flex min-h-dvh flex-col bg-stone-50 p-6 text-stone-900">
        <header className="flex items-center justify-between gap-2">
          <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
            ← Natrag
          </button>
          <button
            onClick={() => setView(view === 'postavke' ? 'vjezba' : 'postavke')}
            aria-label="Postavke"
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              view === 'postavke' ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
            }`}
          >
            ⚙
          </button>
        </header>

        {view === 'postavke' && (
          <section className="mt-4 flex flex-col gap-4 rounded-2xl bg-white p-4 text-sm shadow">
            <div>
              <p className="mb-2 font-semibold">Riječi</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['moje', `moje riječi (${myWords.length})`],
                    ['price', `iz mojih priča (${STORY_WORDS.length})`],
                    ['sve', `N5 + N4 (${WORDS.length})`],
                  ] as const
                ).map(([v, label]) => (
                  <Chip key={v} on={source === v} onClick={() => chooseSource(v)}>
                    {label}
                  </Chip>
                ))}
              </div>
            </div>
            <button onClick={() => setView('vjezba')} className="rounded-2xl bg-stone-800 py-3 font-semibold text-white">
              Vježbaj
            </button>
          </section>
        )}

        {view === 'vjezba' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            {!current ? (
              <p className="text-stone-500">
                {source === 'moje' ? 'Još nemaš svojih riječi. Dodaj ih u 📖 Riječi ili otvori ⚙.' : 'Nema riječi. Otvori ⚙.'}
              </p>
            ) : (
              <>
                <div>
                  {current.level && <p className="text-xs tracking-wide text-stone-400 uppercase">{current.level}</p>}
                  <button
                    onClick={() => speak(current.reading)}
                    className="mt-2 rounded-2xl px-3 py-1 active:bg-stone-200"
                    aria-label="Poslušaj riječ"
                  >
                    <span lang="ja" className="block text-5xl font-medium">
                      <KanjiText text={current.word} /> <span className="align-middle text-2xl">🔊</span>
                    </span>
                    {revealed && (
                      <span className="mt-1 block text-stone-500">
                        <span lang="ja">{current.reading}</span>
                        <span className="italic"> · {toRomaji(current.reading)}</span>
                      </span>
                    )}
                  </button>
                </div>

                <div className="rounded-2xl bg-amber-100 px-5 py-3">
                  <p className="text-sm text-stone-600">Što znači?</p>
                </div>

                {revealed ? (
                  <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow">
                    <p className="text-2xl font-semibold text-red-700">{current.hr}</p>
                  </div>
                ) : (
                  <p className="text-sm text-stone-400">Razmisli ili reci naglas, pa dodirni Pokaži.</p>
                )}
              </>
            )}
          </div>
        )}

        {view === 'vjezba' && current && (
          <div className="flex flex-col gap-2 pb-4">
            {revealed ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => record('znao')}
                    className="rounded-2xl bg-emerald-600 py-5 text-2xl font-bold text-white active:bg-emerald-700"
                  >
                    Znao
                  </button>
                  <button
                    onClick={() => record('nisam')}
                    className="rounded-2xl bg-red-700 py-5 text-2xl font-bold text-white active:bg-red-800"
                  >
                    Nisam
                  </button>
                </div>
                <p className="text-center text-xs text-stone-400">Znao = točno i bez dugog razmišljanja</p>
              </>
            ) : (
              <button
                onClick={() => setRevealed(true)}
                className="w-full rounded-2xl bg-stone-800 py-5 text-2xl font-bold text-white active:bg-stone-900"
              >
                Pokaži
              </button>
            )}
            <button onClick={next} className="py-2 text-sm text-stone-500">
              Preskoči
            </button>
          </div>
        )}
      </main>
    </KanjiMagnifier>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3 py-1.5 ${on ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'}`}
    >
      {children}
    </button>
  )
}
