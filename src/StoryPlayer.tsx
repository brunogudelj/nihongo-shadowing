import { useEffect, useRef, useState } from 'react'
import { audioUrl, type ChunkInfo, type Story } from './stories'
import AddStoryWord from './AddStoryWord'
import { KanjiMagnifier, KanjiText } from './Kanji'
import { useMediaSession, useWakeLock } from './practice'
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

// Uloga riječi (rendgen), kako je zapisuje pipeline.
const WORD_ROLE: Record<string, string> = {
  vrijeme: 'vrijeme', mjesto: 'mjesto', subjekt: 'subjekt', objekt: 'objekt', glagol: 'glagol',
  pridjev: 'pridjev', prilog: 'prilog', imenica: 'imenica', cestica: 'čestica', kopula: 'kopula',
  veznik: 'veznik', interpunkcija: 'interpunkcija', ostalo: 'ostalo',
}

// Isticanje unutar bloka: čestice, kopula i nastavci za konjugaciju.
const KIND_STYLE = {
  cestica: { className: 'font-bold text-blue-700', label: 'čestica' },
  kopula: { className: 'font-bold text-emerald-700', label: 'kopula' },
  nastavak: { className: 'text-orange-600', label: 'nastavak' },
}

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
  const [currentWord, setCurrentWord] = useState(-1)
  // Blok koji svira (ili se ponavlja u petlji); -1 = rečenica.
  const [activeChunk, setActiveChunk] = useState(-1)
  // Rendgen: formule iznad blokova i objašnjenje riječi na dodir (umjesto zvuka).
  const [xray, setXray] = useState(false)
  // Čisti način: samo japanska rečenica, bez furigane i svih dodataka. Pamti se u pregledniku.
  const [clean, setClean] = useState(() => {
    try {
      return localStorage.getItem('cisto') === '1'
    } catch {
      return false
    }
  })
  function toggleClean() {
    const v = !clean
    setClean(v)
    setXray(false)
    setSelected(null)
    try {
      localStorage.setItem('cisto', v ? '1' : '0')
    } catch {
      // bez pamćenja
    }
  }
  // Odabrana riječ ili formula bloka u rendgenu (vrijedi samo za rečenicu u kojoj je odabrana).
  const [selected, setSelected] = useState<{ sentence: number; word?: number; chunk?: number } | null>(null)
  // Petlja: rečenica se ponavlja, sa stankom u kojoj korisnik ponavlja naglas.
  const [loop, setLoop] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const waitTimerRef = useRef<number | undefined>(undefined)
  // Najnovije verzije funkcija, za pozive iz odgođenog ponavljanja
  // (da ponavljanje koristi trenutnu brzinu, i ako je promijenjena u stanci).
  const finishedRef = useRef<() => void>(() => {})
  const replayRef = useRef<(mode: Mode | null) => void>(() => {})
  const urls = useBlobUrls([
    ...story.sentences.flatMap((s) => [s.audio, ...(s.chunk_audio ?? [])]),
    story.audio,
  ])

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
    setActiveChunk(-1)
    play(sentence.audio, 'sentence')
  }

  // Blok ima vlastitu snimku (izgovoren zasebno), pa se ništa ne reže.
  function playChunk(ci: number) {
    const name = sentence.chunk_audio?.[ci]
    if (!name) return
    cancelWait()
    setActiveChunk(ci)
    play(name, 'chunk')
  }

  function playFull() {
    cancelWait()
    setActiveChunk(-1)
    play(story.audio, 'full', sentence.full_start_ms)
  }

  function stop() {
    cancelWait()
    audioRef.current?.pause()
    setPlaying(null)
    setActiveChunk(-1)
  }

  // Rečenica ili blok je odsviran. S petljom: stanka za ponavljanje naglas, pa ispočetka.
  // Stanka traje koliko i odsvirani dio (dulje na sporijoj brzini) plus pola sekunde.
  function finished() {
    const mode = playing
    setPlaying(null)
    if (!loop) {
      setActiveChunk(-1)
      return
    }
    const partMs = (audioRef.current?.duration ?? sentence.duration_ms / 1000) * 1000
    setWaiting(true)
    waitTimerRef.current = window.setTimeout(() => replayRef.current(mode), partMs / speed + 500)
  }

  useEffect(() => {
    finishedRef.current = finished
    replayRef.current = (mode) => (mode === 'chunk' ? playChunk(activeChunk) : playSentence())
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
        } else if (playing === 'sentence') {
          setCurrentWord(wordAt(sentence, ms))
        } else {
          setCurrentWord(-1) // blok: ističe se okvirom oko bloka
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, index, sentence, story.sentences])

  const loaded = urls[sentence.audio] !== undefined
  const busy = playing === 'sentence' || playing === 'chunk' || waiting

  // Zaslon se ne gasi dok vježbaš; Play/Pauza i prethodna/sljedeća rečenica
  // rade i sa zaključanog zaslona, iz obavijesti i sa slušalica.
  useWakeLock()
  useMediaSession({
    title: sentence.ja,
    album: `${story.title_ja} · ${index + 1}/${story.sentences.length}`,
    playing: playing !== null || waiting,
    onPlay: () => (playing === 'full' ? undefined : playSentence()),
    onPause: stop,
    onNext: () => index < story.sentences.length - 1 && goTo(index + 1),
    onPrevious: () => index > 0 && goTo(index - 1),
  })

  return (
    <KanjiMagnifier>
      <main className="flex min-h-dvh flex-col bg-stone-50 p-6 text-stone-900">
        <audio ref={audioRef} onEnded={() => (playing === 'full' ? stop() : finishedRef.current())} />

        <header className="flex items-center justify-between gap-3">
          <button onClick={() => { stop(); onBack() }} className="rounded-full px-3 py-2 text-stone-500 active:bg-stone-200">
            ← Priče
          </button>
          <div className="flex items-center gap-2">
            <p className="text-sm text-stone-400" aria-label={`Rečenica ${index + 1} od ${story.sentences.length}`}>
              {index + 1} / {story.sentences.length}
            </p>
            {!clean && (
              <button
                onClick={() => {
                  setXray(!xray)
                  setSelected(null)
                }}
                aria-pressed={xray}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${
                  xray ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
                }`}
              >
                🔍 Rendgen
              </button>
            )}
            <button
              onClick={toggleClean}
              aria-pressed={clean}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${
                clean ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
              }`}
            >
              Čisto
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          {clean ? (
            <>
              {/* Čisti način: samo rečenica, kako bi je napisao Japanac. */}
              <p lang="ja" className="text-[2rem] leading-[1.6] font-medium">
                <KanjiText text={sentence.ja} />
              </p>
              {waiting && <p className="-mt-4 text-lg font-semibold text-red-700">🗣️ Ponovi</p>}
            </>
          ) : (
            <>
            {/* Rečenica po blokovima (chunkovima), obojenima prema ulozi.
                Uz prijevod se ispod svakog bloka vidi romaji i doslovni prijevod, japanskim redom.
                Formula (zanimljiva gramatika) je iznad bloka: na računalu na hover, u rendgenu uvijek.
                U rendgenu dodir na riječ pokaže objašnjenje; inače dodir na blok pušta njegov zvuk. */}
            <div lang="ja" className="flex flex-wrap items-end justify-center gap-2">
              {spans.map((span, ci) => {
                const info = sentence.chunk_info?.[ci]
                const Block = xray ? 'div' : 'button'
                return (
                  <div key={ci} className="group relative flex flex-col items-center">
                    {/* Rendgen: kratki naslov formule; dodir otvori cijelo objašnjenje ispod rečenice. */}
                    {info?.formula && xray && (
                      <button
                        onClick={() =>
                          setSelected(selected?.sentence === index && selected.chunk === ci ? null : { sentence: index, chunk: ci })
                        }
                        className={`mb-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          selected?.sentence === index && selected.chunk === ci
                            ? 'bg-stone-800 text-white'
                            : 'bg-white text-stone-700 shadow'
                        }`}
                      >
                        ✦ {info.grammar_hr}
                      </button>
                    )}
                    {/* Računalo: cijela formula na hover. */}
                    {info?.formula && !xray && (
                      <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-72 rounded-lg bg-white px-3 py-2 text-left shadow group-hover:block">
                        <FormulaText info={info} />
                      </div>
                    )}
                    <Block
                      onClick={xray ? undefined : () => playChunk(ci)}
                      disabled={xray ? undefined : !sentence.chunk_audio || !urls[sentence.chunk_audio[ci]]}
                      className={`relative flex flex-col items-center rounded-xl px-1.5 ${
                        ROLE_STYLE[info?.role ?? '']?.bg ?? ''
                      } ${activeChunk === ci ? 'ring-2 ring-red-700' : ''}`}
                    >
                      {info?.formula && !xray && (
                        <span className="absolute top-0.5 right-1 text-xs text-stone-500" aria-hidden>
                          ✦
                        </span>
                      )}
                      <span className="text-[2rem] leading-[2.2] font-medium">
                        {sentence.words.slice(span.from, span.to).map((w, k) => {
                          const wi = span.from + k
                          // Riječ koja se upravo izgovara je cijela crvena; inače se ističu čestice i nastavci.
                          const spoken = playing && wi === currentWord
                          const isSelected = selected?.sentence === index && selected.word === wi
                          const parts = w.furigana.map((p, pi) =>
                            p.reading ? (
                              <ruby key={pi}>
                                <KanjiText text={p.text} />
                                <rt className="text-sm text-stone-500">{p.reading}</rt>
                              </ruby>
                            ) : (
                              <span key={pi} className={!spoken && p.kind ? KIND_STYLE[p.kind].className : ''}>
                                {p.text}
                              </span>
                            ),
                          )
                          return xray && w.role !== 'interpunkcija' ? (
                            <button
                              key={wi}
                              onClick={() => setSelected(isSelected ? null : { sentence: index, word: wi })}
                              className={`rounded-md ${spoken ? 'text-red-700' : ''} ${
                                isSelected ? 'bg-white shadow' : 'underline decoration-stone-400 decoration-dotted underline-offset-8'
                              }`}
                            >
                              {parts}
                            </button>
                          ) : (
                            <span key={wi} className={spoken ? 'text-red-700' : ''}>
                              {parts}
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
                    </Block>
                  </div>
                )
              })}
            </div>

            {/* Rendgen: objašnjenje odabrane riječi. */}
            {xray &&
              (() => {
                const sel = selected?.sentence === index ? selected : null
                const chunkInfo = sel?.chunk !== undefined ? sentence.chunk_info?.[sel.chunk] : undefined
                if (chunkInfo)
                  return (
                    <div className="-mt-2 w-full max-w-sm rounded-2xl bg-white p-4 text-left shadow">
                      <div className="flex justify-end">
                        <button onClick={() => setSelected(null)} className="-mb-6 text-stone-400" aria-label="Zatvori">
                          ✕
                        </button>
                      </div>
                      <FormulaText info={chunkInfo} />
                    </div>
                  )
                const w = sel?.word !== undefined ? sentence.words[sel.word] : undefined
                if (!w) return <p className="-mt-3 text-xs text-stone-400">Dodirni riječ ili ✦ za objašnjenje.</p>
                return (
                  <div className="-mt-2 w-full max-w-sm rounded-2xl bg-white p-4 text-left shadow">
                    <div className="flex items-baseline justify-between gap-3">
                      <p lang="ja" className="text-2xl font-medium">
                        {w.text}
                      </p>
                      <button onClick={() => setSelected(null)} className="text-stone-400" aria-label="Zatvori">
                        ✕
                      </button>
                    </div>
                    <p className="text-sm text-stone-500">
                      <span lang="ja">{w.reading}</span>
                      {w.romaji && <span className="italic"> · {w.romaji}</span>}
                      {w.lemma !== w.text && (
                        <>
                          {' '}
                          · osnovni oblik <span lang="ja">{w.lemma}</span>
                        </>
                      )}{' '}
                      · {WORD_ROLE[w.role] ?? w.role}
                    </p>
                    <p className="mt-2 text-stone-800">{w.explanation_hr}</p>
                    {w.role !== 'cestica' && w.role !== 'interpunkcija' && (
                      <div className="mt-3">
                        <AddStoryWord w={w} />
                      </div>
                    )}
                  </div>
                )
              })()}
            {waiting ? (
              <p className="-mt-4 text-lg font-semibold text-red-700">🗣️ Ponovi</p>
            ) : (
              sentence.chunk_audio && !xray && <p className="-mt-4 text-xs text-stone-400">Dodirni blok da ga čuješ.</p>
            )}

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
            </>
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
    </KanjiMagnifier>
  )
}

// Gramatička formula bloka: naziv, formula s čitanjem, kako nastaje, što znači ovdje.
function FormulaText({ info }: { info: ChunkInfo }) {
  return (
    <div lang="hr" className="text-sm leading-snug">
      <p className="font-semibold text-stone-800">✦ {info.grammar_hr}</p>
      <p lang="ja" className="mt-1 text-base text-stone-900">
        {info.formula}
      </p>
      {info.rule_hr && (
        <p className="mt-1 text-stone-600">
          <span className="font-semibold">Kako nastaje:</span> {info.rule_hr}
        </p>
      )}
      {info.formula_hr && (
        <p className="mt-1 text-stone-600">
          <span className="font-semibold">Ovdje:</span> {info.formula_hr}
        </p>
      )}
    </div>
  )
}
