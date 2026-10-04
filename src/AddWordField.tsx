// Polje za novu riječ: dok tipkaš (japanski, romaji ili hrvatski), pokaže riječi koje već postoje na
// popisu; ako je nema, ručni unos (pismo, čitanje, značenje). Ručno dodana riječ još nema izgovor.
import { useEffect, useMemo, useState } from 'react'
import { addMyWord } from './db'
import { isLatin, toHiragana } from './kana'
import { KanjiText } from './Kanji'
import { toRomaji } from './romaji'
import { speak } from './speech'

type Entry = { word: string; reading: string; hr: string; romaji: string }

export default function AddWordField() {
  const [list, setList] = useState<Entry[]>([])
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState<{ word: string; reading: string; hr: string } | null>(null)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    void import('../data/rijeci.json').then((m) =>
      setList((m.default as Omit<Entry, 'romaji'>[]).map((w) => ({ ...w, romaji: toRomaji(w.reading) }))),
    )
  }, [])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const kana = isLatin(q) ? toHiragana(q) : q
    return list
      .filter((w) => w.word.includes(q) || w.reading.includes(kana) || w.romaji.includes(q) || w.hr.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, list])

  function startManual() {
    const q = query.trim()
    // Što je upisano, ide u odgovarajuće polje: japanski u pismo, romaji u čitanje, ostalo u značenje.
    const japanese = /[぀-ヿ㐀-鿿]/.test(q)
    setManual({ word: japanese ? q : '', reading: japanese ? '' : isLatin(q) ? q : '', hr: '' })
  }

  async function saveManual() {
    if (!manual) return
    const reading = isLatin(manual.reading) ? toHiragana(manual.reading.trim()) : manual.reading.trim()
    const word = manual.word.trim() || reading
    if (!word || !reading) return
    await addMyWord({ word, reading, hr: manual.hr.trim(), source: 'rucno' })
    setSaved(word)
    setManual(null)
    setQuery('')
  }

  const readingPreview = manual && isLatin(manual.reading) ? toHiragana(manual.reading.trim()) : ''

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <p className="font-semibold">Upiši riječ</p>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setManual(null)
          setSaved('')
        }}
        placeholder="japanski, romaji ili hrvatski"
        className="mt-2 w-full rounded-xl bg-stone-100 px-4 py-3 text-lg outline-none"
      />
      {saved && <p className="mt-2 text-sm text-emerald-700">Dodano: {saved}</p>}

      {suggestions.length > 0 && (
        <p className="mt-2 text-sm text-stone-500">Već na popisu riječi (dodir pušta izgovor):</p>
      )}
      {suggestions.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {suggestions.map((w) => (
            <li key={w.word + w.reading} className="flex items-center gap-2">
              <button
                onClick={() => speak(w.reading)}
                className="flex min-w-0 flex-1 items-baseline gap-2 rounded-xl px-2 py-2 text-left active:bg-stone-100"
              >
                <span lang="ja" className="text-xl">
                  <KanjiText text={w.word} />
                </span>
                <span lang="ja" className="text-stone-500">
                  {w.reading !== w.word ? w.reading : ''}
                </span>
                <span className="min-w-0 truncate text-sm text-stone-600">
                  <span className="italic text-stone-400">{w.romaji}</span> · {w.hr}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim() && !manual && (
        <button onClick={startManual} className="mt-2 w-full rounded-xl bg-stone-100 py-3 text-stone-700 active:bg-stone-200">
          ➕ {suggestions.length ? 'Nema je? Dodaj kao novu riječ' : 'Nema je na popisu. Dodaj kao novu riječ'}
        </button>
      )}

      {manual && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-sm text-stone-600">
            Pismo (kanji ili kana)
            <input
              value={manual.word}
              onChange={(e) => setManual({ ...manual, word: e.target.value })}
              placeholder="npr. 改札"
              lang="ja"
              className="mt-1 w-full rounded-xl bg-stone-100 px-4 py-2 text-lg text-stone-900 outline-none"
            />
          </label>
          <label className="text-sm text-stone-600">
            Čitanje (kana ili romaji)
            <input
              value={manual.reading}
              onChange={(e) => setManual({ ...manual, reading: e.target.value })}
              placeholder="npr. kaisatsu"
              className="mt-1 w-full rounded-xl bg-stone-100 px-4 py-2 text-lg text-stone-900 outline-none"
            />
            {readingPreview && (
              <span lang="ja" className="mt-1 block text-stone-900">
                → {readingPreview}
              </span>
            )}
          </label>
          <label className="text-sm text-stone-600">
            Značenje (hrvatski)
            <input
              value={manual.hr}
              onChange={(e) => setManual({ ...manual, hr: e.target.value })}
              placeholder="npr. ulaz na peron"
              className="mt-1 w-full rounded-xl bg-stone-100 px-4 py-2 text-lg text-stone-900 outline-none"
            />
          </label>
          <p className="text-xs text-stone-500">Ručno dodana riječ zasad nema izgovor; dobit će ga kasnije.</p>
          <div className="flex gap-2">
            <button
              onClick={saveManual}
              disabled={!manual.reading.trim()}
              className="flex-1 rounded-xl bg-amber-400 py-3 font-semibold text-stone-900 disabled:opacity-40"
            >
              ★ Spremi
            </button>
            <button onClick={() => setManual(null)} className="rounded-xl bg-stone-200 px-4 py-3 text-stone-700">
              Odustani
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
