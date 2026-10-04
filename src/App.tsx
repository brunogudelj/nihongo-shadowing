import { lazy, Suspense, useState } from 'react'
import StoryPlayer from './StoryPlayer'

// Riječi i konjugator nose velike popise, pa se učitavaju tek kad se otvore.
const Conjugator = lazy(() => import('./Conjugator'))
const Vocabulary = lazy(() => import('./Vocabulary'))
import { stories } from './stories'

function App() {
  const [storyId, setStoryId] = useState<string>()
  const [screen, setScreen] = useState<'konjugator' | 'rijeci' | null>(null)
  const story = stories.find((s) => s.id === storyId)

  if (story) return <StoryPlayer story={story} onBack={() => setStoryId(undefined)} />
  if (screen)
    return (
      <Suspense fallback={<p className="p-6 text-center text-stone-400">Učitavam…</p>}>
        {screen === 'konjugator' ? <Conjugator onBack={() => setScreen(null)} /> : <Vocabulary onBack={() => setScreen(null)} />}
      </Suspense>
    )

  return (
    <main className="min-h-dvh bg-stone-50 p-6 text-stone-900">
      <h1 className="mb-6 text-center text-sm text-stone-400">Nihongo Shadowing</h1>
      <ul className="flex flex-col gap-3">
        {stories.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => setStoryId(s.id)}
              className="w-full rounded-2xl bg-white p-5 text-left shadow-sm active:bg-stone-100"
            >
              <p lang="ja" className="text-2xl font-medium">
                {s.title_ja}
              </p>
              <p className="mt-1 text-stone-500">
                {s.title_hr} · {s.sentences.length} rečenica
              </p>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={() => setScreen('rijeci')}
          className="w-full rounded-2xl bg-stone-800 p-5 text-left text-white active:bg-stone-900"
        >
          <p className="text-xl font-semibold">📖 Riječi</p>
          <p className="mt-1 text-stone-300">Svih 1304 riječi N5 + N4, s izgovorom</p>
        </button>
        <button
          onClick={() => setScreen('konjugator')}
          className="w-full rounded-2xl bg-stone-800 p-5 text-left text-white active:bg-stone-900"
        >
          <p className="text-xl font-semibold">🔄 Konjugator</p>
          <p className="mt-1 text-stone-300">Nasumični oblici glagola i pridjeva</p>
        </button>
      </div>
    </main>
  )
}

export default App
