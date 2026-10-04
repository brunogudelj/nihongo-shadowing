// Popis tvojih riječi (★): izgovor na dodir, micanje, i je li pohrana trajna.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import AddWordField from './AddWordField'
import { askPersist, db, removeMyWord } from './db'
import { KanjiMagnifier, KanjiText } from './Kanji'
import { toRomaji } from './romaji'
import { speak } from './speech'

export default function MyWords({ onBack }: { onBack: () => void }) {
  const words = useLiveQuery(() => db.myWords.orderBy('addedAt').reverse().toArray(), [])
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    void askPersist().then(setPersisted)
  }, [])

  return (
    <KanjiMagnifier>
      <main className="min-h-dvh bg-stone-50 p-6 text-stone-900">
        <header className="mb-4 flex items-center justify-between">
          <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
            ← Natrag
          </button>
          <p className="text-sm text-stone-400">{words?.length ?? 0} riječi</p>
        </header>

        <h1 className="text-2xl font-semibold">⭐ Moje riječi</h1>
        <p className="mt-1 text-sm text-stone-500">
          Riječi koje si označio sa ☆ (u pričama u Rendgenu, u popisu riječi i u konjugatoru) ili upisao sam. Iz njih nastaju
          kartice za ponavljanje.
        </p>
        {persisted === false && (
          <p className="mt-2 rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
            Preglednik nije odobrio trajnu pohranu, pa bi mogao obrisati ove podatke kad mu treba mjesta. Zato redovito
            izvezi sigurnosnu kopiju (na dnu početnog zaslona).
          </p>
        )}

        <AddWordField />

        {words && words.length === 0 && (
          <p className="mt-8 text-center text-stone-400">Još nema riječi. Dodaj ih sa ☆.</p>
        )}

        <ul className="mt-4 flex flex-col gap-2">
          {words?.map((w) => (
            <li key={w.id} className="flex items-center gap-2">
              <button
                onClick={() => speak(w.reading)}
                className="flex min-w-0 flex-1 items-baseline gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm active:bg-stone-100"
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
                  <span className="text-sm text-stone-400 italic">{toRomaji(w.reading)}</span>
                  <span className="block text-stone-700">{w.hr}</span>
                  {w.source === 'rucno' && <span className="text-xs text-stone-400">upisano ručno · zasad bez izgovora</span>}
                </span>
              </button>
              <button
                onClick={() => removeMyWord(w.id)}
                aria-label="Makni"
                className="rounded-full bg-stone-200 px-3 py-2 text-stone-600 active:bg-stone-300"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

      </main>
    </KanjiMagnifier>
  )
}
