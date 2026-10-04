// Gumb ★ za dodavanje riječi u "Moje riječi" (i micanje, ako je već dodana).
import { useLiveQuery } from 'dexie-react-hooks'
import { addMyWord, db, removeMyWord, wordId, type MyWord } from './db'

type Props = Omit<MyWord, 'id' | 'addedAt'> & { label?: boolean }

export default function AddWord({ label, ...w }: Props) {
  const id = wordId(w.word, w.reading)
  const saved = useLiveQuery(() => db.myWords.get(id), [id])
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        void (saved ? removeMyWord(id) : addMyWord(w))
      }}
      aria-pressed={!!saved}
      aria-label={saved ? 'Makni iz mojih riječi' : 'Dodaj u moje riječi'}
      className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${
        saved ? 'bg-amber-400 text-stone-900' : 'bg-stone-100 text-stone-500'
      }`}
    >
      {saved ? '★' : '☆'}
      {label && (saved ? ' U mojim riječima' : ' Dodaj u moje riječi')}
    </button>
  )
}
