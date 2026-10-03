import { useEffect, useRef, useState } from 'react'
import { audioUrl, type Story } from './stories'
import { chunkSpans, wordAt, wordAtInFull } from './timing'

const SPEEDS = [0.7, 0.85, 1]

// Boja bloka prema ulozi u rečenici (iz pipelinea, polje chunk_info).
const ROLE_STYLE: Record<string, { bg: string; label: string }> = {
  vrijeme: { bg: 'bg-amber-100', label: 'vrijeme' },
  mjesto: { bg: 'bg-sky-100', label: 'mjesto' },
  subjekt: { bg: 'bg-emerald-100', label: 'tema / subjekt' },
  objekt: { bg: 'bg-violet-100', label: 'objekt' },
  glagol: { bg: 'bg-rose-100', label: 'glagol' },
  opis: { bg: 'bg-stone-200', label: 'opis / ostalo' },
  ostalo: { bg: 'bg-stone-200', label: 'opis / ostalo' },
}
const LEGEND = ['vrijeme', 'mjesto', 'subjekt', 'objekt', 'glagol', 'opis']

// Isticanje unutar bloka: čestice, kopula i nastavci za konjugaciju.
const KIND_STYLE = {
  cestica: { className: 'font-bold text-blue-700', label: 'čestica' },
  kopula: { className: 'font-bold text-emerald-700', label: 'kopula' },
  nastavak: { className: 'text-orange-600', label: 'nastavak' },
}

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
  const [currentWord, setCurrentWord] = useState(-1)
  // Petlja: rečenica se ponavlja, sa stankom u kojoj korisnik ponavlja naglas.
  const [loop, setLoop] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const waitTimerRef = useRef<number | undefined>(undefined)
  // Najnovije verzije funkcija, za pozive iz odgođenog ponavljanja
  // (da ponavljanje koristi trenutnu brzinu, i ako je promijenjena u stanci).
  const finishedRef = useRef<() => void>(() => {})
  const replayRef = useRef<() => void>(() => {})
  const urls = useBlobUrls([...story.sentences.map((s) => s.audio), story.audio])

  const sentence = story.sentences[index]
  const spans = chunkSpans(sentence)

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

  function cancelWait() {
    window.clearTimeout(waitTimerRef.current)
    setWaiting(false)
  }

  function playSentence() {
    cancelWait()
    play(sentence.audio, 'sentence')
  }

  function playFull() {
    cancelWait()
    play(story.audio, 'full', sentence.full_start_ms)
  }

  function stop() {
    cancelWait()
    audioRef.current?.pause()
    setPlaying(null)
  }

  // Rečenica je odsvirana. S petljom: stanka za ponavljanje naglas, pa ispočetka.
  // Stanka traje koliko i rečenica (dulje na sporijoj brzini) plus pola sekunde.
  function finished() {
    setPlaying(null)
    if (!loop) return
    setWaiting(true)
    waitTimerRef.current = window.setTimeout(() => replayRef.current(), sentence.duration_ms / speed + 500)
  }

  useEffect(() => {
    finishedRef.current = finished
    replayRef.current = playSentence
  })

  // Zaustavi čekanje ako se zaslon zatvori.
  useEffect(() => () => window.clearTimeout(waitTimerRef.current), [])

  function toggleLoop() {
    if (loop) stop()
    setLoop(!loop)
  }

  function goTo(i: number) {
    setIndex(i)
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

  // Dok zvuk svira: isticanje riječi i, tijekom cijele priče, praćenje rečenice
  // koja se čuje. Provjera ~60 puta u sekundi.
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
          }
          setCurrentWord(wordAtInFull(sentence, ms))
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
  const busy = playing === 'sentence' || waiting

  return (
    <main className="flex min-h-dvh flex-col bg-stone-50 p-6 text-stone-900">
      <audio ref={audioRef} onEnded={() => (playing === 'full' ? stop() : finishedRef.current())} />

      <header className="flex items-center justify-between gap-3">
        <button onClick={() => { stop(); onBack() }} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
          ← Priče
        </button>
        <p className="text-sm text-stone-400">
          Rečenica {index + 1} / {story.sentences.length}
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {/* Rečenica po blokovima (chunkovima), obojenima prema ulozi.
            Uz prijevod se ispod svakog bloka vidi doslovni prijevod, japanskim redom. */}
        <div lang="ja" className="flex flex-wrap items-start justify-center gap-2">
          {spans.map((span, ci) => {
            const info = sentence.chunk_info?.[ci]
            return (
              <div
                key={ci}
                className={`flex flex-col items-center rounded-xl px-1.5 ${ROLE_STYLE[info?.role ?? '']?.bg ?? ''}`}
              >
                <span className="text-[2rem] leading-[2.2] font-medium">
                  {sentence.words.slice(span.from, span.to).map((w, k) => {
                    const wi = span.from + k
                    // Riječ koja se upravo izgovara je cijela crvena; inače se ističu čestice i nastavci.
                    const spoken = playing && wi === currentWord
                    return (
                      <span key={wi} className={spoken ? 'text-red-700' : ''}>
                        {w.furigana.map((p, pi) =>
                          p.reading ? (
                            <ruby key={pi}>
                              {p.text}
                              <rt className="text-sm text-stone-500">{p.reading}</rt>
                            </ruby>
                          ) : (
                            <span key={pi} className={!spoken && p.kind ? KIND_STYLE[p.kind].className : ''}>
                              {p.text}
                            </span>
                          ),
                        )}
                      </span>
                    )
                  })}
                </span>
                {showTranslation && (
                  <span lang="ja-Latn" className="-mt-1 text-sm text-stone-500 italic">
                    {sentence.words
                      .slice(span.from, span.to)
                      .map((w) => w.romaji ?? '')
                      .join(' ')
                      .replace(/ ([,.])/g, '$1')}
                  </span>
                )}
                {showTranslation && info && (
                  <span lang="hr" className="pb-1 text-sm text-stone-700">
                    {info.literal_hr}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {waiting && <p className="-mt-4 text-lg font-semibold text-red-700">🗣️ Ponovi</p>}

        <button
          onClick={() => setShowTranslation(!showTranslation)}
          className="rounded-full px-4 py-2 text-stone-500 active:bg-stone-200"
        >
          {showTranslation ? sentence.hr : 'Prikaži prijevod'}
        </button>
        {showTranslation && sentence.chunk_info && (
          <div className="-mt-3 flex flex-wrap justify-center gap-1.5 text-xs text-stone-600">
            {LEGEND.map((role) => (
              <span key={role} className={`rounded-full px-2 py-0.5 ${ROLE_STYLE[role].bg}`}>
                {ROLE_STYLE[role].label}
              </span>
            ))}
            {Object.values(KIND_STYLE).map((k) => (
              <span key={k.label} className={`rounded-full bg-white px-2 py-0.5 ${k.className}`}>
                {k.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 pb-4">
        <div className="grid grid-cols-4 gap-3">
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
          <button
            onClick={toggleLoop}
            aria-pressed={loop}
            aria-label="Ponavljaj"
            className={`rounded-2xl py-3 text-lg font-semibold ${
              loop ? 'bg-red-700 text-white' : 'bg-stone-200 text-stone-700'
            }`}
          >
            🔁
          </button>
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
            onClick={() => (busy ? stop() : playSentence())}
            disabled={!loaded}
            className="rounded-2xl bg-red-700 py-5 text-2xl font-bold text-white active:bg-red-800 disabled:opacity-50"
          >
            {busy ? '■ Stani' : '▶ Slušaj'}
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
          onClick={() => (playing === 'full' ? stop() : playFull())}
          disabled={urls[story.audio] === undefined}
          className="rounded-2xl bg-stone-200 py-4 text-lg font-semibold text-stone-700 active:bg-stone-300 disabled:opacity-50"
        >
          {playing === 'full' ? '❚❚ Zaustavi priču' : '▶ Cijela priča od ove rečenice'}
        </button>
      </div>
    </main>
  )
}
