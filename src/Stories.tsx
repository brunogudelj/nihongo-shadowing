// Popis svih priča, s napretkom (koliko je rečenica gotovo).
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { stories } from './stories'

export default function Stories({ onOpen, onBack }: { onOpen: (id: string) => void; onBack: () => void }) {
  const done = useLiveQuery(() => db.sentences.filter((r) => r.status === 'gotova').toArray(), [])

  return (
    <main className="min-h-dvh bg-stone-50 p-6 text-stone-900">
      <header className="mb-4 flex items-center justify-between">
        <button onClick={onBack} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
          ← Natrag
        </button>
        <p className="text-sm text-stone-400">{stories.length} priče</p>
      </header>
      <h1 className="mb-4 text-2xl font-semibold">📚 Priče</h1>
      <ul className="flex flex-col gap-3">
        {stories.map((s) => {
          const n = done?.filter((r) => r.storyId === s.id).length ?? 0
          return (
            <li key={s.id}>
              <button
                onClick={() => onOpen(s.id)}
                className="w-full rounded-2xl bg-white p-5 text-left shadow-sm active:bg-stone-100"
              >
                <p lang="ja" className="text-2xl font-medium">
                  {s.title_ja}
                </p>
                <p className="mt-1 text-stone-500">
                  {s.title_hr} · {s.sentences.length} rečenica{n > 0 ? ` · ${n} / ${s.sentences.length} gotovo` : ''}
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
