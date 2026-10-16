// Rečenica za kontekst koja se pojavi nakon "Pokaži": furigana, 🔊 i hrvatski prijevod na dodir.
// Tražena riječ je istaknuta crveno. Ako riječi nema ni u jednoj priči, ne prikazuje se ništa.
import { useState } from 'react'
import { contextKey, pickContext } from './context'
import { audioUrl } from './stories'
import { titleOf } from './vodic-text'

// Zadnja prikazana rečenica po riječi, da idući put dođe druga.
const lastShown = new Map<string, string>()
let playing: HTMLAudioElement | null = null

function playAudio(name: string) {
  const url = audioUrl(name)
  if (!url) return
  playing?.pause()
  const audio = new Audio(url)
  audio.preservesPitch = true
  playing = audio
  void audio.play().catch(() => {})
}

// Komponentu treba prikazati s key={lemma}, da nova riječ dobije novu rečenicu.
export default function ContextSentence({ lemma }: { lemma: string }) {
  const [ctx] = useState(() => {
    const c = pickContext(lemma, lastShown.get(lemma))
    if (c) lastShown.set(lemma, contextKey(c))
    return c
  })
  const [showHr, setShowHr] = useState(false)
  if (!ctx) return null
  const { sentence, words } = ctx
  return (
    <div className="mt-3 w-full rounded-2xl bg-stone-100 p-4 text-left">
      <p className="text-xs text-stone-500">
        <span lang="ja">{titleOf(ctx.storyId)}</span>, rečenica {ctx.index + 1}
      </p>
      <p lang="ja" className="mt-1 text-2xl leading-[2.2]">
        {sentence.words.map((w, wi) => (
          <span key={wi} className={words.includes(wi) ? 'font-semibold text-red-700' : ''}>
            {w.furigana.map((p, pi) =>
              p.reading ? (
                <ruby key={pi}>
                  {p.text}
                  <rt className="text-xs font-normal text-stone-500">{p.reading}</rt>
                </ruby>
              ) : (
                <span key={pi}>{p.text}</span>
              ),
            )}
          </span>
        ))}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => playAudio(sentence.audio)}
          aria-label="Poslušaj rečenicu"
          className="rounded-xl bg-stone-200 px-4 py-2 font-semibold text-stone-800 active:bg-stone-300"
        >
          🔊
        </button>
        <button
          onClick={() => setShowHr(!showHr)}
          className="flex-1 rounded-xl bg-stone-200 px-4 py-2 text-left text-stone-700 active:bg-stone-300"
        >
          {showHr ? sentence.hr : 'Prijevod'}
        </button>
      </div>
    </div>
  )
}
