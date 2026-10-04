import { useMemo, useState } from 'react'
import allWords from '../data/konjugator.json'
import formMeanings from '../data/konjugator-oblici.json'
import { conjugate, FORMS, kindOf, type ConjWord, type Form, type Kind } from './conjugate'
import { toRomaji } from './romaji'
import { speak } from './speech'
import { stories } from './stories'

const WORDS = allWords as ConjWord[]
// Hrvatsko značenje svakog oblika: { 食べる: { masu: "jedem (uljudno)", … } }
const MEANINGS = formMeanings as Record<string, Record<string, string>>

const CLASS_LABEL: Record<string, string> = {
  godan: 'godan glagol',
  ichidan: 'ichidan glagol',
  iku: 'godan glagol (iznimka)',
  aru: 'godan glagol (iznimka)',
  kuru: 'nepravilan glagol',
  suru: 'nepravilan glagol',
  'suru-imenica': 'する-glagol (nepravilan)',
  'i-pridjev': 'i-pridjev',
  ii: 'i-pridjev (iznimka)',
  'na-pridjev': 'na-pridjev',
}

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'glagol', label: 'glagoli' },
  { kind: 'i-pridjev', label: 'i-pridjevi' },
  { kind: 'na-pridjev', label: 'na-pridjevi' },
]

// Osnovni oblici riječi iz priča (za izvor "Moje priče").
const STORY_LEMMAS = new Set(stories.flatMap((s) => s.sentences.flatMap((x) => x.words.map((w) => w.lemma))))
const STORY_WORDS = WORDS.filter((w) => STORY_LEMMAS.has(w.word) || STORY_LEMMAS.has(w.word.replace(/する$/, '')))

// Postavke se pamte u pregledniku (ako je dostupno).
function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // bez pamćenja
  }
}

type Task = { word: ConjWord; form: Form }

function pick(words: ConjWord[], forms: Form[]): Task | null {
  const options = words.flatMap((word) => forms.filter((f) => f.kind === kindOf(word)).map((form) => ({ word, form })))
  return options.length ? options[Math.floor(Math.random() * options.length)] : null
}

export default function Conjugator({ onBack }: { onBack: () => void }) {
  const [source, setSource] = useState<'price' | 'sve'>(() => load('konj-izvor', 'sve'))
  const [kinds, setKinds] = useState<Kind[]>(() => load('konj-vrste', ['glagol', 'i-pridjev', 'na-pridjev']))
  const [formIds, setFormIds] = useState<string[]>(() => load('konj-oblici', FORMS.map((f) => f.id)))
  const [showSettings, setShowSettings] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const words = useMemo(
    () => (source === 'price' ? STORY_WORDS : WORDS).filter((w) => kinds.includes(kindOf(w))),
    [source, kinds],
  )
  const forms = useMemo(() => FORMS.filter((f) => formIds.includes(f.id) && kinds.includes(f.kind)), [formIds, kinds])
  const [task, setTask] = useState<Task | null>(() => pick(words, forms))

  function next() {
    setTask(pick(words, forms))
    setRevealed(false)
  }

  function toggleKind(kind: Kind) {
    const v = kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind]
    setKinds(v)
    save('konj-vrste', v)
  }
  function toggleForm(id: string) {
    const v = formIds.includes(id) ? formIds.filter((f) => f !== id) : [...formIds, id]
    setFormIds(v)
    save('konj-oblici', v)
  }
  function chooseSource(v: 'price' | 'sve') {
    setSource(v)
    save('konj-izvor', v)
  }

  const answer = task ? conjugate(task.word, task.form.id) : null

  return (
    <main className="flex min-h-dvh flex-col bg-stone-50 p-6 text-stone-900">
      <header className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200"
        >
          ← Priče
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`rounded-full px-3 py-2 text-sm font-semibold ${
            showSettings ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
          }`}
        >
          ⚙ Postavke
        </button>
      </header>

      {showSettings && (
        <section className="mt-4 flex flex-col gap-4 rounded-2xl bg-white p-4 text-sm shadow">
          <div>
            <p className="mb-2 font-semibold">Riječi</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['price', `iz mojih priča (${STORY_WORDS.length})`],
                  ['sve', `N5 + N4 (${WORDS.length})`],
                ] as const
              ).map(([v, label]) => (
                <Chip key={v} on={source === v} onClick={() => chooseSource(v)}>
                  {label}
                </Chip>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Chip key={k.kind} on={kinds.includes(k.kind)} onClick={() => toggleKind(k.kind)}>
                  {k.label}
                </Chip>
              ))}
            </div>
          </div>
          {KINDS.filter((k) => kinds.includes(k.kind)).map((k) => (
            <div key={k.kind}>
              <p className="mb-2 font-semibold">Oblici: {k.label}</p>
              <div className="flex flex-wrap gap-2">
                {FORMS.filter((f) => f.kind === k.kind).map((f) => (
                  <Chip key={f.id} on={formIds.includes(f.id)} onClick={() => toggleForm(f.id)}>
                    {f.label} <span lang="ja">{f.ending}</span>
                    {f.level === 'N4' && <span className="ml-1 opacity-60">N4</span>}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              setShowSettings(false)
              next()
            }}
            className="rounded-2xl bg-stone-800 py-3 font-semibold text-white"
          >
            Gotovo
          </button>
        </section>
      )}

      {!showSettings && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          {!task || !answer ? (
            <p className="text-stone-500">Nema riječi za odabrane postavke. Otvori ⚙ Postavke.</p>
          ) : (
            <>
              <div>
                <p className="text-xs tracking-wide text-stone-400 uppercase">
                  {CLASS_LABEL[task.word.class]} · {task.word.level}
                </p>
                <button
                  onClick={() => speak(task.word.reading)}
                  className="mt-2 rounded-2xl px-3 py-1 active:bg-stone-200"
                  aria-label="Poslušaj osnovni oblik"
                >
                  <span lang="ja" className="block text-5xl font-medium">
                    {task.word.word} <span className="align-middle text-2xl">🔊</span>
                  </span>
                  <span className="mt-1 block text-stone-500">
                    <span lang="ja">{task.word.reading}</span>
                    <span className="italic"> · {toRomaji(task.word.reading)}</span>
                  </span>
                </button>
                <p className="mt-1 text-lg">{task.word.hr}</p>
              </div>

              <div className="rounded-2xl bg-amber-100 px-5 py-3">
                <p className="text-sm text-stone-600">Pretvori u:</p>
                <p className="text-xl font-semibold">
                  {task.form.label} <span lang="ja">{task.form.ending}</span>
                </p>
              </div>

              {revealed ? (
                <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow">
                  <button
                    onClick={() => speak(answer.reading)}
                    className="w-full rounded-2xl py-1 active:bg-stone-100"
                    aria-label="Poslušaj oblik"
                  >
                    <span lang="ja" className="block text-4xl font-medium text-red-700">
                      {answer.written} <span className="align-middle text-2xl">🔊</span>
                    </span>
                    <span className="mt-1 block text-stone-500">
                      <span lang="ja">{answer.reading}</span>
                      <span className="italic"> · {toRomaji(answer.reading)}</span>
                    </span>
                  </button>
                  {MEANINGS[task.word.word]?.[task.form.id] && (
                    <p className="mt-2 text-lg">„{MEANINGS[task.word.word][task.form.id]}"</p>
                  )}
                  <p className="mt-3 text-left text-sm text-stone-700">{answer.rule}</p>
                </div>
              ) : (
                <p className="text-sm text-stone-400">Razmisli ili reci naglas, pa dodirni Pokaži.</p>
              )}
            </>
          )}
        </div>
      )}

      {!showSettings && task && (
        <div className="pb-4">
          {revealed ? (
            <button
              onClick={next}
              className="w-full rounded-2xl bg-red-700 py-5 text-2xl font-bold text-white active:bg-red-800"
            >
              Sljedeća ▶
            </button>
          ) : (
            <button
              onClick={() => setRevealed(true)}
              className="w-full rounded-2xl bg-stone-800 py-5 text-2xl font-bold text-white active:bg-stone-900"
            >
              Pokaži
            </button>
          )}
        </div>
      )}
    </main>
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
