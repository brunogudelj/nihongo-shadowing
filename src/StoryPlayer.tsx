import { useEffect, useRef, useState } from 'react'
import { audioUrl, type Story } from './stories'
import { chunkSpans, wordAt, wordAtInFull } from './timing'

const SPEEDS = [0.7, 0.85, 1]

type Mode = 'sentence' | 'chunk' | 'full'

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
  const [activeChunk, setActiveChunk] = useState(-1)
  const [currentWord, setCurrentWord] = useState(-1)
  // Gdje zaustaviti zvuk (ms u mp3 rečenice); null = do kraja.
  const stopAtRef = useRef<number | null>(null)
  const urls = useBlobUrls([...story.sentences.map((s) => s.audio), story.audio])

  const sentence = story.sentences[index]
  const spans = chunkSpans(sentence)

  function play(name: string, mode: Mode, startMs = 0, stopAtMs: number | null = null) {
    const audio = audioRef.current
    const src = urls[name]
    if (!audio || !src) return
    audio.src = src
    audio.preservesPitch = true
    audio.defaultPlaybackRate = speed
    audio.playbackRate = speed
    stopAtRef.current = stopAtMs
    // Skok na mjesto u zvuku tek kad se datoteka učita, pa tek onda sviranje.
    if (startMs) {
      audio.addEventListener(
        'loadedmetadata',
        () => {
          audio.currentTime = startMs / 1000
          audio.play()
        },
        { once: true },
      )
    } else {
      audio.play()
    }
    setPlaying(mode)
  }

  function playChunk(ci: number) {
    const span = spans[ci]
    setActiveChunk(ci)
    // Mala zaliha na početku i kraju, da se ne odreže početak ili kraj sloga.
    play(sentence.audio, 'chunk', Math.max(0, span.startMs - 60), span.endMs + 120)
  }

  function stop() {
    audioRef.current?.pause()
    setPlaying(null)
    setActiveChunk(-1)
  }

  function goTo(i: number) {
    setIndex(i)
    setShowTranslation(false)
    setActiveChunk(-1)
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

  // Dok zvuk svira: isticanje riječi, zaustavljanje na kraju chunka i, tijekom
  // cijele priče, praćenje rečenice koja se čuje. Provjera ~60 puta u sekundi.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      const audio = audioRef.current
      if (audio) {
        const ms = audio.currentTime * 1000
        if (playing === 'full') {
          const current = story.sentences.findLastIndex((s) => s.full_start_ms <= ms)
          if (current >= 0 && current !== index) {
            setIndex(current)
            setShowTranslation(false)
          }
          setCurrentWord(wordAtInFull(sentence, ms))
        } else if (stopAtRef.current !== null && ms >= stopAtRef.current) {
          audio.pause()
          setPlaying(null)
          setActiveChunk(-1)
          return
        } else {
          setCurrentWord(wordAt(sentence, ms))
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, index, sentence, story.sentences])

  const loaded = urls[sentence.audio] !== undefined

  return (
    <main className="flex min-h-dvh flex-col bg-stone-50 p-6 text-stone-900">
      <audio
        ref={audioRef}
        onEnded={() => {
          setPlaying(null)
          setActiveChunk(-1)
        }}
      />

      <header className="flex items-center justify-between gap-3">
        <button onClick={() => { stop(); onBack() }} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
          ← Priče
        </button>
        <p className="text-sm text-stone-400">
          Rečenica {index + 1} / {story.sentences.length}
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {/* Rečenica po chunkovima: dodir na chunk pušta samo taj dio. */}
        <p lang="ja" className="flex flex-wrap justify-center gap-x-2 text-[2rem] leading-[2.2] font-medium">
          {spans.map((span, ci) => (
            <button
              key={ci}
              onClick={() => playChunk(ci)}
              disabled={!loaded}
              className={`rounded-lg px-1 transition-colors active:bg-stone-200 ${
                activeChunk === ci ? 'bg-red-100' : ''
              }`}
            >
              {sentence.words.slice(span.from, span.to).map((w, k) => {
                const wi = span.from + k
                return (
                  <span key={wi} className={playing && wi === currentWord ? 'text-red-700' : ''}>
                    {w.furigana.map((p, pi) =>
                      p.reading ? (
                        <ruby key={pi}>
                          {p.text}
                          <rt className="text-sm text-stone-500">{p.reading}</rt>
                        </ruby>
                      ) : (
                        <span key={pi}>{p.text}</span>
                      ),
                    )}
                  </span>
                )
              })}
            </button>
          ))}
        </p>
        <p className="-mt-4 text-xs text-stone-400">Dodirni dio rečenice da ga čuješ.</p>

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
