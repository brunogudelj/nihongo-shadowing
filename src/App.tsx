import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useState } from 'react'
import BackupPanel from './BackupPanel'
import { db } from './db'
import StoryPlayer from './StoryPlayer'
import Stories from './Stories'
import TodayPlan from './TodayPlan'
import { stories } from './stories'

// Riječi, moje riječi i konjugator nose velike popise, pa se učitavaju tek kad se otvore.
const Conjugator = lazy(() => import('./Conjugator'))
const Vocabulary = lazy(() => import('./Vocabulary'))
const MyWords = lazy(() => import('./MyWords'))
const Training = lazy(() => import('./Training'))
const WordDrill = lazy(() => import('./WordDrill'))

type Screen = 'price' | 'rijeci' | 'moje' | 'ponavljanje' | 'konjugator' | 'trening' | 'trening-kratki'

const CARDS: { screen: Exclude<Screen, 'trening' | 'trening-kratki'>; title: string; text: string }[] = [
  { screen: 'price', title: '📚 Priče', text: `${stories.length} priče za shadowing` },
  { screen: 'rijeci', title: '📖 Riječi', text: 'Svih 1304 riječi N5 + N4, s izgovorom' },
  { screen: 'moje', title: '⭐ Moje riječi', text: 'Označene sa ☆ i one koje upišeš sam' },
  { screen: 'ponavljanje', title: '🔁 Ponavljanje riječi', text: 'Pokaži → Znao / Nisam, kao u konjugatoru' },
  { screen: 'konjugator', title: '🔄 Konjugator', text: 'Nasumični oblici glagola i pridjeva' },
]

function App() {
  const [storyId, setStoryId] = useState<string>()
  const [screen, setScreen] = useState<Screen | null>(null)
  // Gdje si zadnje stao, za ▶ Nastavi.
  const lastPlace = useLiveQuery(() => db.places.orderBy('updatedAt').last(), [])
  const lastStory = stories.find((s) => s.id === lastPlace?.storyId)
  const story = stories.find((s) => s.id === storyId)

  if (story) return <StoryPlayer story={story} onBack={() => setStoryId(undefined)} />
  if (screen === 'price') return <Stories onOpen={setStoryId} onBack={() => setScreen(null)} />
  if (screen)
    return (
      <Suspense fallback={<p className="p-6 text-center text-stone-400">Učitavam…</p>}>
        {screen === 'konjugator' && <Conjugator onBack={() => setScreen(null)} />}
        {screen === 'ponavljanje' && <WordDrill onBack={() => setScreen(null)} />}
        {screen === 'rijeci' && <Vocabulary onBack={() => setScreen(null)} />}
        {screen === 'moje' && <MyWords onBack={() => setScreen(null)} />}
        {(screen === 'trening' || screen === 'trening-kratki') && (
          <Training short={screen === 'trening-kratki'} onBack={() => setScreen(null)} />
        )}
      </Suspense>
    )

  return (
    <main className="min-h-dvh bg-stone-50 p-6 text-stone-900">
      <h1 className="mb-6 text-center text-sm text-stone-400">Nihongo Shadowing</h1>
      <TodayPlan onStart={(short) => setScreen(short ? 'trening-kratki' : 'trening')} />
      {lastStory && lastPlace && (
        <button
          onClick={() => setStoryId(lastStory.id)}
          className="mb-4 w-full rounded-2xl bg-red-700 p-5 text-left text-white active:bg-red-800"
        >
          <p className="text-xl font-semibold">▶ Nastavi</p>
          <p className="mt-1 text-red-100">
            <span lang="ja">{lastStory.title_ja}</span> · rečenica {lastPlace.index + 1} / {lastStory.sentences.length}
          </p>
        </button>
      )}

      <div className="flex flex-col gap-3">
        {CARDS.map((c) => (
          <button
            key={c.screen}
            onClick={() => setScreen(c.screen)}
            className="w-full rounded-2xl bg-stone-800 p-5 text-left text-white active:bg-stone-900"
          >
            <p className="text-xl font-semibold">{c.title}</p>
            <p className="mt-1 text-stone-300">{c.text}</p>
          </button>
        ))}
      </div>

      {/* Sigurnosna kopija napretka, na dnu (rijetko treba). */}
      <details className="mt-8 text-stone-600">
        <summary className="cursor-pointer text-sm">💾 Sigurnosna kopija napretka</summary>
        <BackupPanel />
      </details>
    </main>
  )
}

export default App
