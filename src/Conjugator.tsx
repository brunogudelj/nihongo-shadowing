import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import allWords from '../data/konjugator.json'
import formMeanings from '../data/konjugator-oblici.json'
import AddWord from './AddWord'
import { conjugate, FORMS, kindOf, ruleOf, wordClassOf, type ConjWord, type Form, type Kind } from './conjugate'
import { pruneIds, weakPoints, weakWords } from './conjugator-stats'
import { db } from './db'
import { KanjiMagnifier, KanjiText } from './Kanji'
import { toRomaji } from './romaji'
import { readSetting, writeSetting, type SettingKey } from './settings'
import { speak } from './speech'
import { stories } from './stories'
import { KONJUGATOR } from './vodic-config'

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

// Postavke se pamte u pregledniku (settings.ts) i ulaze u sigurnosnu kopiju.
function load<T>(key: SettingKey, fallback: T): T {
  try {
    const v = readSetting(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: SettingKey, value: unknown) {
  writeSetting(key, JSON.stringify(value))
}

type Source = 'price' | 'sve' | 'slabe'
type Task = { word: ConjWord; form: Form }
// Vježba samo jedne stavke iz "Gdje zapinjem": točke (oblik + pravilo) ili riječi.
type Focus = { kind: 'point'; point: string; label: string } | { kind: 'word'; word: string } | null

const pointOf = (w: ConjWord, formId: string) => `${formId}|${ruleOf(w, formId).key}`
const randomOf = <T,>(xs: T[]): T | null => (xs.length ? xs[Math.floor(Math.random() * xs.length)] : null)

export default function Conjugator({ onBack }: { onBack: () => void }) {
  const [source, setSource] = useState<Source>(() => load('konj-izvor', 'sve'))
  const [kinds, setKinds] = useState<Kind[]>(() => load('konj-vrste', ['glagol', 'i-pridjev', 'na-pridjev']))
  const [formIds, setFormIds] = useState<string[]>(() => load('konj-oblici', FORMS.map((f) => f.id)))
  const [view, setView] = useState<'vjezba' | 'postavke' | 'zapinjem'>('vjezba')
  const [revealed, setRevealed] = useState(false)
  const [focus, setFocus] = useState<Focus>(null)

  // Svi zapisani odgovori (za slabe točke). Svako otvaranje konjugatora je jedna sesija.
  const attempts = useLiveQuery(() => db.conjAttempts.toArray(), [])
  const [session] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const weak = useMemo(() => weakPoints(attempts ?? []), [attempts])
  const weakW = useMemo(() => weakWords(attempts ?? []), [attempts])

  // Kad zapisa ima previše, najstariji se brišu (jednom, pri otvaranju).
  useEffect(() => {
    void db.conjAttempts.toArray().then((all) => {
      const ids = pruneIds(all)
      if (ids.length) void db.conjAttempts.bulkDelete(ids)
    })
  }, [])

  const forms = useMemo(() => FORMS.filter((f) => formIds.includes(f.id) && kinds.includes(f.kind)), [formIds, kinds])

  // Svi mogući zadaci prema izvoru (ili prema odabranoj stavci iz "Gdje zapinjem").
  const tasks = useMemo((): Task[] => {
    if (focus?.kind === 'point') {
      const [formId] = focus.point.split('|')
      const form = FORMS.find((f) => f.id === formId)
      if (!form) return []
      return WORDS.filter((w) => kindOf(w) === form.kind && pointOf(w, formId) === focus.point).map((word) => ({ word, form }))
    }
    if (focus?.kind === 'word') {
      const word = WORDS.find((w) => w.word === focus.word)
      if (!word) return []
      const own = FORMS.filter((f) => f.kind === kindOf(word))
      const on = own.filter((f) => formIds.includes(f.id))
      return (on.length ? on : own).map((form) => ({ word, form }))
    }
    if (source === 'slabe') {
      // Slabe točke (unutar uključenih oblika) i slabe riječi.
      const fromPoints = weak.flatMap((p) => {
        const form = forms.find((f) => f.id === p.form)
        if (!form) return []
        return WORDS.filter((w) => kindOf(w) === form.kind && pointOf(w, form.id) === p.point).map((word) => ({ word, form }))
      })
      const fromWords = weakW.flatMap(({ word }) => {
        const w = WORDS.find((x) => x.word === word)
        return w ? forms.filter((f) => f.kind === kindOf(w)).map((form) => ({ word: w, form })) : []
      })
      return [...fromPoints, ...fromWords]
    }
    const words = (source === 'price' ? STORY_WORDS : WORDS).filter((w) => kinds.includes(kindOf(w)))
    return words.flatMap((word) => forms.filter((f) => f.kind === kindOf(word)).map((form) => ({ word, form })))
  }, [focus, source, weak, weakW, forms, formIds, kinds])

  // Riječ s "Nisam" vraća se nakon ~5 drugih zadataka.
  const answered = useRef(0)
  const retries = useRef<{ task: Task; due: number }[]>([])
  const [task, setTask] = useState<Task | null>(null)
  // Dok zadatak nije izričito odabran (na početku ili nakon promjene izvora), uzme se jedan
  // nasumični i ostaje isti dok se popis zadataka ne promijeni.
  const fallback = useMemo(() => randomOf(tasks), [tasks])
  const current = task ?? fallback

  function next() {
    const dueIndex = retries.current.findIndex((r) => r.due <= answered.current)
    if (dueIndex >= 0) {
      setTask(retries.current.splice(dueIndex, 1)[0].task)
    } else {
      setTask(randomOf(tasks))
    }
    setRevealed(false)
  }

  async function record(result: 'znao' | 'nisam') {
    if (!current) return
    const { word, form } = current
    const rule = ruleOf(word, form.id)
    await db.conjAttempts.add({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      v: 1,
      at: Date.now(),
      word: word.word,
      reading: word.reading,
      wordClass: wordClassOf(word),
      form: form.id,
      point: `${form.id}|${rule.key}`,
      rule: rule.label,
      direction: 'proizvodnja',
      source: 'slobodno',
      session,
      result,
    })
    answered.current++
    if (result === 'nisam') retries.current.push({ task: current, due: answered.current + KONJUGATOR.retryAfter })
    next()
  }

  function toggleKind(kind: Kind) {
    const v = kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind]
    setKinds(v)
    save('konj-vrste', v)
  }
  function setForms(v: string[]) {
    setFormIds(v)
    save('konj-oblici', v)
  }
  function toggleForm(id: string) {
    setForms(formIds.includes(id) ? formIds.filter((f) => f !== id) : [...formIds, id])
  }
  // Sve oblike jedne skupine (ili svih skupina) odjednom uključi ili isključi.
  function setGroup(kind: Kind | null, on: boolean) {
    const ids = FORMS.filter((f) => kind === null || f.kind === kind).map((f) => f.id)
    setForms(on ? [...new Set([...formIds, ...ids])] : formIds.filter((id) => !ids.includes(id)))
  }
  function chooseSource(v: Source) {
    setSource(v)
    save('konj-izvor', v)
  }
  function practise(f: Focus) {
    setFocus(f)
    setTask(null)
    setRevealed(false)
    setView('vjezba')
  }

  const answer = current ? conjugate(current.word, current.form.id) : null
  const formLabel = (id: string) => FORMS.find((f) => f.id === id)?.label ?? id

  return (
    <KanjiMagnifier>
      <main className="flex min-h-dvh flex-col bg-stone-50 p-6 text-stone-900">
        <header className="flex items-center justify-between gap-2">
          <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
            ← Natrag
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setView(view === 'zapinjem' ? 'vjezba' : 'zapinjem')}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${
                view === 'zapinjem' ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
              }`}
            >
              Gdje zapinjem
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
          </div>
        </header>

        {view === 'postavke' && (
          <section className="mt-4 flex flex-col gap-4 rounded-2xl bg-white p-4 text-sm shadow">
            <div>
              <p className="mb-2 font-semibold">Riječi</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['price', `iz mojih priča (${STORY_WORDS.length})`],
                    ['sve', `N5 + N4 (${WORDS.length})`],
                    ['slabe', `moje slabe točke (${weak.length + weakW.length})`],
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
            <div className="flex gap-2">
              <button onClick={() => setGroup(null, false)} className="flex-1 rounded-xl bg-stone-200 py-2 font-semibold">
                Isključi sve oblike
              </button>
              <button onClick={() => setGroup(null, true)} className="flex-1 rounded-xl bg-stone-200 py-2 font-semibold">
                Uključi sve
              </button>
            </div>
            {KINDS.filter((k) => kinds.includes(k.kind)).map((k) => (
              <div key={k.kind}>
                <div className="mb-2 flex items-center gap-2">
                  <p className="flex-1 font-semibold">Oblici: {k.label}</p>
                  <button onClick={() => setGroup(k.kind, true)} className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
                    sve
                  </button>
                  <button onClick={() => setGroup(k.kind, false)} className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
                    ništa
                  </button>
                </div>
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
                setView('vjezba')
                setFocus(null)
                next()
              }}
              className="rounded-2xl bg-stone-800 py-3 font-semibold text-white"
            >
              Gotovo
            </button>
          </section>
        )}

        {view === 'zapinjem' && (
          <section className="mt-4 flex flex-col gap-4 text-sm">
            <h1 className="text-xl font-semibold">Gdje zapinjem</h1>
            {!attempts?.length && <p className="text-stone-500">Još nema odgovora. Vježbaj pa odgovaraj sa Znao / Nisam.</p>}
            {attempts && attempts.length > 0 && weak.length === 0 && weakW.length === 0 && (
              <p className="text-stone-500">Trenutno nema slabih točaka. 🎉</p>
            )}
            {weak.length > 0 && (
              <div>
                <p className="mb-2 font-semibold">Oblik i pravilo</p>
                <ul className="flex flex-col gap-2">
                  {weak.slice(0, KONJUGATOR.listMax).map((p) => (
                    <li key={p.point}>
                      <button
                        onClick={() => practise({ kind: 'point', point: p.point, label: `${formLabel(p.form)} · ${p.rule}` })}
                        className="w-full rounded-2xl bg-white p-4 text-left shadow-sm active:bg-stone-100"
                      >
                        <p className="font-semibold">{formLabel(p.form)}</p>
                        <p lang="ja">{p.rule}</p>
                        <p className="text-stone-500">
                          npr. <span lang="ja">{p.example}</span> · Nisam: {p.recentFails} od zadnjih {p.recentCount}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {weakW.length > 0 && (
              <div>
                <p className="mb-2 font-semibold">Riječi</p>
                <ul className="flex flex-wrap gap-2">
                  {weakW.slice(0, KONJUGATOR.listMax).map((w) => (
                    <li key={w.word}>
                      <button
                        onClick={() => practise({ kind: 'word', word: w.word })}
                        lang="ja"
                        className="rounded-2xl bg-white px-4 py-3 text-xl shadow-sm active:bg-stone-100"
                      >
                        {w.word}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-stone-400">Dodir na stavku pokreće vježbu samo te točke ili riječi.</p>
          </section>
        )}

        {view === 'vjezba' && focus && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">
            <span className="flex-1" lang="ja">
              Vježbaš samo: {focus.kind === 'point' ? focus.label : focus.word}
            </span>
            <button onClick={() => practise(null)} aria-label="Makni ograničenje" className="px-2 font-semibold">
              ✕
            </button>
          </div>
        )}

        {view === 'vjezba' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            {!current || !answer ? (
              <p className="text-stone-500">
                {source === 'slabe' && !focus
                  ? 'Nema slabih točaka u uključenim oblicima. 🎉'
                  : 'Nema riječi za odabrane postavke. Otvori ⚙.'}
              </p>
            ) : (
              <>
                <div>
                  <p className="text-xs tracking-wide text-stone-400 uppercase">
                    {CLASS_LABEL[current.word.class]} · {current.word.level}
                  </p>
                  <button
                    onClick={() => speak(current.word.reading)}
                    className="mt-2 rounded-2xl px-3 py-1 active:bg-stone-200"
                    aria-label="Poslušaj osnovni oblik"
                  >
                    <span lang="ja" className="block text-5xl font-medium">
                      <KanjiText text={current.word.word} /> <span className="align-middle text-2xl">🔊</span>
                    </span>
                    <span className="mt-1 block text-stone-500">
                      <span lang="ja">{current.word.reading}</span>
                      <span className="italic"> · {toRomaji(current.word.reading)}</span>
                    </span>
                  </button>
                  <p className="mt-1 flex items-center justify-center gap-2 text-lg">
                    {current.word.hr}
                    <AddWord word={current.word.word} reading={current.word.reading} hr={current.word.hr} source="konjugator" />
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-100 px-5 py-3">
                  <p className="text-sm text-stone-600">Pretvori u:</p>
                  <p className="text-xl font-semibold">
                    {current.form.label} <span lang="ja">{current.form.ending}</span>
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
                        <KanjiText text={answer.written} /> <span className="align-middle text-2xl">🔊</span>
                      </span>
                      <span className="mt-1 block text-stone-500">
                        <span lang="ja">{answer.reading}</span>
                        <span className="italic"> · {toRomaji(answer.reading)}</span>
                      </span>
                    </button>
                    {MEANINGS[current.word.word]?.[current.form.id] && (
                      <p className="mt-2 text-lg">„{MEANINGS[current.word.word][current.form.id]}"</p>
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
