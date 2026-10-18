import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { audioUrl, type ChunkInfo, type Story } from './stories'
import AddStoryWord from './AddStoryWord'
import { db, savePlace, setSentenceStatus, type SentenceStatus } from './db'
import { KanjiMagnifier, KanjiText } from './Kanji'
import { useMediaSession, useWakeLock } from './practice'
import { readSetting, writeSetting } from './settings'
import { chunkSpans, wordAt, wordAtInFull } from './timing'

const SPEEDS = [0.7, 0.85, 1]

// Razina pomoći, od najviše prema najmanjoj; jedan gumb ih mijenja redom.
export type View = 'rendgen' | 'puno' | 'cisto' | 'sluh'
const VIEWS: Record<View, { label: string; next: View }> = {
  rendgen: { label: '🔍 Rendgen', next: 'puno' },
  puno: { label: 'Puno', next: 'cisto' },
  cisto: { label: 'Čisto', next: 'sluh' },
  sluh: { label: '👂 Sluh', next: 'rendgen' },
}
// Stanka u petlji, kao dio duljine odsviranog dijela; 0 = preklapanje (ponavlja se odmah).
const PAUSES = [0, 1, 1.5, 2]

// Status rečenice: kako se prikazuje i koji je idući na dodir.
const STATUS: Record<SentenceStatus, { label: string; dot: string; chip: string; next: SentenceStatus }> = {
  nova: { label: '○ nova', dot: 'bg-stone-300', chip: 'bg-stone-200 text-stone-700', next: 'u-radu' },
  'u-radu': { label: '◐ u radu', dot: 'bg-amber-400', chip: 'bg-amber-200 text-amber-900', next: 'gotova' },
  gotova: { label: '● gotova', dot: 'bg-emerald-500', chip: 'bg-emerald-200 text-emerald-900', next: 'nova' },
}

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

// Ikone kontrola (jednobojne, kao u glazbenom playeru).
const Icon = ({ d, className = 'h-6 w-6' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d={d} />
  </svg>
)
const ICON = {
  prev: 'M6 5h2v14H6zM20 5v14L9 12z',
  next: 'M16 5h2v14h-2zM4 5l11 7-11 7z',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  loop: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z',
}

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

// Postavke s kojima vodič otvara priču (rečenica, razina pomoći, brzina, petlja) i uputa za korak.
// Ne mijenjaju spremljene postavke, osim ako ih korisnik sam promijeni u priči.
export type StoryPreset = {
  index?: number
  view?: View
  speed?: number
  loop?: boolean
  pause?: number
  translation?: boolean
  note?: string
}

export default function StoryPlayer({ story, onBack, preset }: { story: Story; onBack: () => void; preset?: StoryPreset }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [index, setIndex] = useState(preset?.index ?? 0)
  // Status svake rečenice (iz baze na mobitelu) i pamćenje gdje si stao.
  const statusRows = useLiveQuery(() => db.sentences.where('storyId').equals(story.id).toArray(), [story.id])
  const statusOf = (i: number): SentenceStatus => statusRows?.find((r) => r.index === i)?.status ?? 'nova'
  const placeLoaded = useRef(preset?.index !== undefined)
  useEffect(() => {
    if (preset?.index !== undefined) return // vodič je zadao rečenicu
    void db.places.get(story.id).then((place) => {
      if (place && place.index < story.sentences.length) setIndex(place.index)
      placeLoaded.current = true
    })
  }, [story.id, story.sentences.length, preset?.index])
  useEffect(() => {
    if (placeLoaded.current) void savePlace(story.id, index)
  }, [story.id, index])
  // Brzina se pamti (i ulazi u sigurnosnu kopiju).
  const [speed, setSpeed] = useState(() => {
    if (preset?.speed) return preset.speed
    const raw = readSetting('brzina')
    return raw !== null && SPEEDS.includes(Number(raw)) ? Number(raw) : 1
  })
  const [playing, setPlaying] = useState<Mode | null>(null)
  const [showTranslation, setShowTranslation] = useState(preset?.translation ?? false)
  const [currentWord, setCurrentWord] = useState(-1)
  // Napredak zvuka (0–1) za tanku traku iznad kontrola: rečenica/blok, ili cijela priča.
  const [progress, setProgress] = useState(0)
  // Blok koji svira (ili se ponavlja u petlji); -1 = rečenica.
  const [activeChunk, setActiveChunk] = useState(-1)
  // Razina pomoći (pamti se u pregledniku): rendgen (formule, objašnjenje riječi na dodir umjesto zvuka),
  // puno (sve pomoći), čisto (samo japanski tekst) ili sluh (tekst skriven dok ga ne otkriješ dodirom).
  const [view, setView] = useState<View>(() => {
    if (preset?.view) return preset.view
    const v = readSetting('prikaz')
    if (v === 'rendgen' || v === 'cisto' || v === 'sluh') return v
    return readSetting('cisto') === '1' ? 'cisto' : 'puno'
  })
  const [revealed, setRevealed] = useState(false)
  const clean = view === 'cisto'
  const xray = view === 'rendgen'
  const hidden = view === 'sluh' && !revealed
  function cycleView() {
    const v = VIEWS[view].next
    setView(v)
    setRevealed(false)
    setSelected(null)
    writeSetting('prikaz', v)
  }
  // Odabrana riječ ili formula bloka u rendgenu (vrijedi samo za rečenicu u kojoj je odabrana).
  const [selected, setSelected] = useState<{ sentence: number; word?: number; chunk?: number } | null>(null)
  // Petlja: rečenica se ponavlja, sa stankom u kojoj korisnik ponavlja naglas.
  const [loop, setLoop] = useState(preset?.loop ?? false)
  const [pause, setPause] = useState(() => {
    if (preset?.pause !== undefined) return preset.pause
    const raw = readSetting('stanka')
    return raw !== null && PAUSES.includes(Number(raw)) ? Number(raw) : 1
  })
  function choosePause(v: number) {
    setPause(v)
    writeSetting('stanka', String(v))
  }
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
    setProgress(0)
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
    // Preklapanje: odmah ispočetka, bez stanke "Ponovi".
    if (pause === 0) {
      waitTimerRef.current = window.setTimeout(() => replayRef.current(mode), 150)
      return
    }
    const partMs = (audioRef.current?.duration ?? sentence.duration_ms / 1000) * 1000
    setWaiting(true)
    waitTimerRef.current = window.setTimeout(() => replayRef.current(mode), (pause * partMs) / speed + 400)
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
    setRevealed(false)
    // Tijekom cijele priče skoči na tu rečenicu, inače samo zaustavi.
    if (playing === 'full' && audioRef.current) {
      audioRef.current.currentTime = story.sentences[i].full_start_ms / 1000
    } else {
      stop()
    }
  }

  // Jedan gumb za brzinu: 1× → 0.85× → 0.7× → 1×.
  function cycleSpeed() {
    chooseSpeed(SPEEDS[(SPEEDS.indexOf(speed) + SPEEDS.length - 1) % SPEEDS.length])
  }

  function chooseSpeed(rate: number) {
    setSpeed(rate)
    writeSetting('brzina', String(rate))
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
        if (audio.duration) setProgress(audio.currentTime / audio.duration)
        if (playing === 'full') {
          const current = story.sentences.findLastIndex((s) => s.full_start_ms <= ms)
          if (current >= 0 && current !== index) {
            setIndex(current)
            setRevealed(false)
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
      <main className="flex h-dvh flex-col bg-stone-50 px-4 pt-2 text-stone-900 landscape:px-6">
        <audio ref={audioRef} onEnded={() => (playing === 'full' ? stop() : finishedRef.current())} />

        {/* Tanka gornja traka: natrag, naslov, točkice rečenica (dodir = idi na nju), status i razina pomoći. */}
        <header className="flex items-center gap-2 text-sm">
          <button
            onClick={() => { stop(); onBack() }}
            aria-label={preset ? 'Natrag na vodič' : 'Natrag na priče'}
            className="shrink-0 rounded-full px-2 py-1 text-lg text-stone-500 active:bg-stone-200"
          >
            ←
          </button>
          <p lang="ja" className="min-w-0 truncate text-stone-500">
            {story.title_ja}
          </p>
          <div className="ml-auto flex shrink-0 items-center gap-1" aria-label={`Rečenica ${index + 1} od ${story.sentences.length}`}>
            {story.sentences.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Rečenica ${i + 1}`}
                className={`h-2.5 w-2.5 rounded-full ${STATUS[statusOf(i)].dot} ${i === index ? 'ring-2 ring-stone-800 ring-offset-1' : ''}`}
              />
            ))}
          </div>
          <button
            onClick={() => setSentenceStatus(story.id, index, STATUS[statusOf(index)].next)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[statusOf(index)].chip}`}
          >
            {STATUS[statusOf(index)].label}
          </button>
          <button
            onClick={cycleView}
            aria-label={`Razina pomoći: ${VIEWS[view].label}. Dodirni za iduću.`}
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              view !== 'puno' ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
            }`}
          >
            {VIEWS[view].label}
          </button>
        </header>

        {preset?.note && (
          <p className="mt-1 rounded-xl bg-amber-100 px-3 py-1.5 text-sm text-amber-900">🧭 {preset.note}</p>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
        <div className="m-auto flex w-full flex-col items-center gap-4 text-center">
          {hidden ? (
            <>
              {/* Slušni način: tekst skriven, dodir ga otkriva. */}
              <button
                onClick={() => setRevealed(true)}
                className="w-full max-w-sm rounded-3xl border-2 border-dashed border-stone-300 px-6 py-12 text-stone-500 active:bg-stone-100"
              >
                <span className="block text-4xl">👂</span>
                <span className="mt-2 block text-lg font-semibold">Slušaj</span>
                <span className="block text-sm">dodirni za tekst</span>
              </button>
              {waiting && <p className="-mt-4 text-lg font-semibold text-red-700">🗣️ Ponovi</p>}
            </>
          ) : clean ? (
            <>
              {/* Čisti način: samo rečenica, kako bi je napisao Japanac. */}
              <p lang="ja" className="text-[2rem] leading-[1.6] font-medium landscape:text-[1.75rem]">
                {sentence.words.map((w, wi) => (
                  <span key={wi} className={playing && wi === currentWord ? 'text-red-700' : ''}>
                    <KanjiText text={w.text} word={{ text: w.text, reading: w.reading, romaji: w.romaji, meaning: w.explanation_hr }} />
                  </span>
                ))}
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
                      <span className="text-[2rem] leading-[2.2] font-medium landscape:text-[1.6rem] landscape:leading-[2]">
                        {sentence.words.slice(span.from, span.to).map((w, k) => {
                          const wi = span.from + k
                          // Riječ koja se upravo izgovara je cijela crvena; inače se ističu čestice i nastavci.
                          const spoken = playing && wi === currentWord
                          const isSelected = selected?.sentence === index && selected.word === wi
                          const parts = w.furigana.map((p, pi) =>
                            p.reading ? (
                              <ruby key={pi}>
                                <KanjiText text={p.text} word={{ text: w.text, reading: w.reading, romaji: w.romaji, meaning: w.explanation_hr }} />
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

        </div>
        {/* Kontrole kao u glazbenom playeru: tanka traka napretka i jedan red gumba. */}
        <div className="shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {loop && (
            <div className="mb-1 flex items-center justify-center gap-1.5 text-xs">
              <span className="text-stone-500">Stanka:</span>
              {PAUSES.map((v) => (
                <button
                  key={v}
                  onClick={() => choosePause(v)}
                  aria-pressed={pause === v}
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    pause === v ? 'bg-red-700 text-white' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {v === 0 ? '0 · uz glas' : `${String(v).replace('.', ',')}×`}
                </button>
              ))}
            </div>
          )}
          <div className="h-1 overflow-hidden rounded-full bg-stone-200" aria-hidden>
            <div className="h-full bg-red-700" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="mx-auto mt-1 flex max-w-xl items-center justify-between gap-1">
            <button
              onClick={cycleSpeed}
              aria-label={`Brzina ${speed}×. Dodirni za iduću.`}
              className={`w-14 rounded-full py-2 text-sm font-semibold ${
                speed === 1 ? 'text-stone-600 active:bg-stone-200' : 'bg-stone-800 text-white'
              }`}
            >
              {speed}×
            </button>
            <button
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Prethodna rečenica"
              className="rounded-full p-3 text-stone-700 active:bg-stone-200 disabled:opacity-30"
            >
              <Icon d={ICON.prev} />
            </button>
            <button
              onClick={() => (busy ? stop() : playSentence())}
              disabled={!loaded}
              aria-label={busy ? 'Stani' : 'Slušaj rečenicu'}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-700 text-2xl text-white shadow active:bg-red-800 disabled:opacity-50"
            >
              <Icon d={busy ? ICON.pause : ICON.play} className="h-7 w-7" />
            </button>
            <button
              onClick={() => goTo(index + 1)}
              disabled={index === story.sentences.length - 1}
              aria-label="Sljedeća rečenica"
              className="rounded-full p-3 text-stone-700 active:bg-stone-200 disabled:opacity-30"
            >
              <Icon d={ICON.next} />
            </button>
            <button
              onClick={toggleLoop}
              aria-pressed={loop}
              aria-label="Ponavljaj"
              className={`rounded-full p-2.5 ${loop ? 'bg-red-700 text-white' : 'text-stone-700 active:bg-stone-200'}`}
            >
              <Icon d={ICON.loop} className="h-5 w-5" />
            </button>
            <button
              onClick={() => (playing === 'full' ? stop() : playFull())}
              disabled={urls[story.audio] === undefined}
              aria-label={playing === 'full' ? 'Zaustavi priču' : 'Cijela priča od ove rečenice'}
              className={`rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                playing === 'full' ? 'bg-stone-800 text-white' : 'text-stone-600 active:bg-stone-200'
              }`}
            >
              {playing === 'full' ? '❚❚ priča' : '▶▶ priča'}
            </button>
          </div>
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
