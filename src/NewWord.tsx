// Nova riječ: upišeš riječ; ako je već na popisu, vidiš je, a ako nije, dodaš je ručno.
// Ručno dodane riječi pojavljuju se i u 📖 Riječi (oznaka "moja").
import { useLiveQuery } from 'dexie-react-hooks'
import AddWordField from './AddWordField'
import { db, removeMyWord } from './db'
import { KanjiMagnifier, KanjiText } from './Kanji'
import { toRomaji } from './romaji'

export default function NewWord({ onBack }: { onBack: () => void }) {
  const mine = useLiveQuery(() => db.myWords.filter((w) => w.source === 'rucno').reverse().sortBy('addedAt'), [])

  return (
    <KanjiMagnifier>
      <main className="min-h-dvh bg-stone-50 p-6 text-stone-900">
        <header className="mb-4 flex items-center justify-between">
          <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
            ← Natrag
          </button>
        </header>
        <h1 className="text-2xl font-semibold">➕ Nova riječ</h1>
        <p className="mt-1 text-sm text-stone-500">
          Naišao si na zanimljivu riječ? Upiši je. Ako već postoji na popisu riječi, vidjet ćeš je; ako ne, dodaj je.
        </p>

        <AddWordField />

        {mine && mine.length > 0 && (
          <>
            <p className="mt-6 font-semibold">Riječi koje sam dodao ({mine.length})</p>
            <ul className="mt-2 flex flex-col gap-2">
              {mine.map((w) => (
                <li key={w.id} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm">
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
                  </span>
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
            <p className="mt-2 text-xs text-stone-400">Ručno dodane riječi zasad nemaju izgovor.</p>
          </>
        )}
      </main>
    </KanjiMagnifier>
  )
}
