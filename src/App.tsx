import { useState } from 'react'
import Conjugator from './Conjugator'
import StoryPlayer from './StoryPlayer'
import { stories } from './stories'

function App() {
  const [storyId, setStoryId] = useState<string>()
  const [conjugator, setConjugator] = useState(false)
  const story = stories.find((s) => s.id === storyId)

  if (story) return <StoryPlayer story={story} onBack={() => setStoryId(undefined)} />
  if (conjugator) return <Conjugator onBack={() => setConjugator(false)} />

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

      <button
        onClick={() => setConjugator(true)}
        className="mt-6 w-full rounded-2xl bg-stone-800 p-5 text-left text-white active:bg-stone-900"
      >
        <p className="text-xl font-semibold">🔄 Konjugator</p>
        <p className="mt-1 text-stone-300">Nasumični oblici glagola i pridjeva</p>
      </button>
    </main>
  )
}

export default App
