import { useEffect, useRef, useState } from 'react'
import sentence from '../content/prototip.json'

// Svi mp3 iz content/audio, po imenu datoteke.
const audioFiles = import.meta.glob<string>('../content/audio/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
})
const audioUrl = audioFiles[`../content/audio/${sentence.id}.mp3`]

const SPEEDS = [0.7, 0.85, 1]

function App() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [audioSrc, setAudioSrc] = useState<string>()

  // mp3 se učitava cijeli u memoriju: iPhone tada pouzdano pušta i offline
  // (iz spremljene kopije ne zna puštati "u komadićima").
  useEffect(() => {
    if (!audioUrl) return
    let objectUrl: string | undefined
    fetch(audioUrl)
      .then((res) => res.blob())
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setAudioSrc(objectUrl)
      })
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  function applySpeed(rate: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.preservesPitch = true
    audio.playbackRate = rate
  }

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      return
    }
    applySpeed(speed)
    audio.play()
  }

  function chooseSpeed(rate: number) {
    setSpeed(rate)
    applySpeed(rate)
  }

  return (
    <main className="flex min-h-dvh flex-col bg-stone-50 p-6 text-stone-900">
      <h1 className="text-center text-sm text-stone-400">Nihongo Shadowing</h1>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p lang="ja" className="text-4xl leading-[2.2] font-medium">
          {sentence.segments.map((s, i) =>
            s.reading ? (
              <ruby key={i}>
                {s.text}
                <rt className="text-base text-stone-500">{s.reading}</rt>
              </ruby>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </p>

        <button
          onClick={() => setShowTranslation(!showTranslation)}
          className="rounded-full px-4 py-2 text-stone-500 underline-offset-4 active:bg-stone-200"
        >
          {showTranslation ? sentence.translation : 'Prikaži prijevod'}
        </button>
      </div>

      <div className="flex flex-col gap-4 pb-4">
        {audioUrl ? (
          <>
            <audio
              ref={audioRef}
              src={audioSrc}
              preload="auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            <div className="grid grid-cols-3 gap-3">
              {SPEEDS.map((rate) => (
                <button
                  key={rate}
                  onClick={() => chooseSpeed(rate)}
                  className={`rounded-2xl py-4 text-lg font-semibold ${
                    speed === rate ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {rate}×
                </button>
              ))}
            </div>
            <button
              onClick={togglePlay}
              className="rounded-2xl bg-red-700 py-6 text-2xl font-bold text-white active:bg-red-800"
            >
              {playing ? '❚❚ Pauza' : '▶ Slušaj'}
            </button>
          </>
        ) : (
          <p className="rounded-2xl bg-amber-100 p-4 text-center text-amber-900">
            Zvuk još nije izrađen. U terminalu pokreni: <code>npm run tts</code>
          </p>
        )}
      </div>
    </main>
  )
}

export default App
