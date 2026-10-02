import { useEffect, useRef, useState } from 'react'
import { audioUrl, type Story } from './stories'

const SPEEDS = [0.7, 0.85, 1]

type Mode = 'sentence' | 'full'

// mp3 se učitava cijeli u memoriju, da pouzdano svira i bez interneta.
function useBlobUrls(names: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = names.join('|')
  useEffect(() => {
    const created: string[] = []
    let cancelled = false
    for (const name of key.split('|')) {
      const url = audioUrl(name)
      if (!url) continue
      fetch(url)
        .then((res) => res.blob())
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob)
          created.push(objectUrl)
          if (!cancelled) setUrls((prev) => ({ ...prev, [name]: objectUrl }))
        })
    }
    return () => {
      cancelled = true
      created.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [key])
  return urls
}

export default function StoryPlayer({ story, onBack }: { story: Story; onBack: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [index, setIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState<Mode | null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const urls = useBlobUrls([...story.sentences.map((s) => s.audio), story.audio])

  const sentence = story.sentences[index]

  function play(name: string, mode: Mode, startMs = 0) {
    const audio = audioRef.current
    const src = urls[name]
    if (!audio || !src) return
    audio.src = src
    audio.preservesPitch = true
    audio.defaultPlaybackRate = speed
    audio.playbackRate = speed
    // Skok na mjesto u zvuku tek kad se datoteka učita.
    if (startMs) audio.addEventListener('loadedmetadata', () => (audio.currentTime = startMs / 1000), { once: true })
    audio.play()
    setPlaying(mode)
  }

  function stop() {
    audioRef.current?.pause()
    setPlaying(null)
  }

  function goTo(i: number) {
    setIndex(i)
    setShowTranslation(false)
    // Tijekom cijele priče skoči na tu rečenicu, inače samo zaustavi.
    if (playing === 'full' && audioRef.current) {
      audioRef.current.currentTime = story.sentences[i].full_start_ms / 1000
    } else {
      stop()
    }
  }

  function chooseSpeed(rate: number) {
    setSpeed(rate)
    const audio = audioRef.current
    if (!audio) return
    audio.defaultPlaybackRate = rate
    audio.playbackRate = rate
  }

  // Tijekom cijele priče prikaz prati rečenicu koja se trenutno čuje.
  function onTimeUpdate() {
    const audio = audioRef.current
    if (!audio || playing !== 'full') return
    const ms = audio.currentTime * 1000
    const current = story.sentences.findLastIndex((s) => s.full_start_ms <= ms)
    if (current >= 0 && current !== index) {
      setIndex(current)
      setShowTranslation(false)
    }
  }

  const loaded = urls[sentence.audio] !== undefined

  return (
    <main className="flex min-h-dvh flex-col bg-stone-50 p-6 text-stone-900">
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onEnded={() => setPlaying(null)} />

      <header className="flex items-center justify-between gap-3">
        <button onClick={() => { stop(); onBack() }} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
          ← Priče
        </button>
        <p className="text-sm text-stone-400">
          Rečenica {index + 1} / {story.sentences.length}
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p lang="ja" className="text-[2rem] leading-[2.2] font-medium">
          {sentence.words.flatMap((w, wi) =>
            w.furigana.map((p, pi) =>
              p.reading ? (
                <ruby key={`${wi}-${pi}`}>
                  {p.text}
                  <rt className="text-sm text-stone-500">{p.reading}</rt>
                </ruby>
              ) : (
                <span key={`${wi}-${pi}`}>{p.text}</span>
              ),
            ),
          )}
        </p>

        <button
          onClick={() => setShowTranslation(!showTranslation)}
          className="rounded-full px-4 py-2 text-stone-500 active:bg-stone-200"
        >
          {showTranslation ? sentence.hr : 'Prikaži prijevod'}
        </button>
      </div>

      <div className="flex flex-col gap-3 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {SPEEDS.map((rate) => (
            <button
              key={rate}
              onClick={() => chooseSpeed(rate)}
              className={`rounded-2xl py-3 text-lg font-semibold ${
                speed === rate ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {rate}×
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_2fr_1fr] gap-3">
          <button
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="rounded-2xl bg-stone-200 py-5 text-2xl text-stone-700 disabled:opacity-30"
            aria-label="Prethodna rečenica"
          >
            ◀
          </button>
          <button
            onClick={() => (playing === 'sentence' ? stop() : play(sentence.audio, 'sentence'))}
            disabled={!loaded}
            className="rounded-2xl bg-red-700 py-5 text-2xl font-bold text-white active:bg-red-800 disabled:opacity-50"
          >
            {playing === 'sentence' ? '❚❚ Pauza' : '▶ Slušaj'}
          </button>
          <button
            onClick={() => goTo(index + 1)}
            disabled={index === story.sentences.length - 1}
            className="rounded-2xl bg-stone-200 py-5 text-2xl text-stone-700 disabled:opacity-30"
            aria-label="Sljedeća rečenica"
          >
            ▶
          </button>
        </div>

        <button
          onClick={() => (playing === 'full' ? stop() : play(story.audio, 'full', sentence.full_start_ms))}
          disabled={urls[story.audio] === undefined}
          className="rounded-2xl bg-stone-200 py-4 text-lg font-semibold text-stone-700 active:bg-stone-300 disabled:opacity-50"
        >
          {playing === 'full' ? '❚❚ Zaustavi priču' : '▶ Cijela priča od ove rečenice'}
        </button>
      </div>
    </main>
  )
}
