// Kartica riječi s kanjijima: gore cijela riječ (čitanje, romaji, značenje u kontekstu), ispod njeni kanjiji.
// Dodir na kanji pokaže njegova čitanja (on/kun) s romajijem, značenje i riječi u kojima se pojavljuje.
// Na računalu se pokaže na hover, na mobitelu na dugi pritisak (ostaje otvorena dok se ne dodirne izvan nje).
// Podaci (data/kanji.json, data/rijeci.json) učitavaju se tek kad zatrebaju.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { toRomaji } from './romaji'

const KANJI = /[㐀-䶿一-鿿々]/
const LONG_PRESS_MS = 400

type KanjiInfo = { level: string; on: string[]; kun: string[]; meanings: string }
type WordInfo = { word: string; reading: string; hr: string }
type Data = { kanji: Record<string, KanjiInfo>; words: WordInfo[] }

let dataPromise: Promise<Data> | null = null
function loadData(): Promise<Data> {
  dataPromise ??= Promise.all([import('../data/kanji.json'), import('../data/rijeci.json')]).then(([k, w]) => ({
    kanji: k.default as Record<string, KanjiInfo>,
    words: w.default as WordInfo[],
  }))
  return dataPromise
}

// Riječ u kojoj je kanji: tekst, čitanje i značenje (u priči: značenje u toj rečenici).
export type WordContext = { text: string; reading?: string; romaji?: string; meaning?: string }

// Kartica: gdje (pokraj kanjija na računalu, ili na sredini na mobitelu), koji znak i u kojoj riječi.
type Shown = { char: string; word?: WordContext; sticky: boolean; x?: number; y?: number }
type Magnify = { show: (s: Shown) => void; hide: (onlyHover?: boolean) => void; wasLongPress: () => boolean }
const MagnifyContext = createContext<Magnify | null>(null)

// Omotaj zaslon: prikazuje karticu i pamti je li zadnji dodir bio dugi pritisak.
export function KanjiMagnifier({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null)
  const longPress = useRef(false)
  const value: Magnify = {
    show: (s) => {
      if (s.sticky) longPress.current = true
      setShown(s)
    },
    hide: (onlyHover) => setShown((cur) => (onlyHover && cur?.sticky ? cur : null)),
    // Nakon dugog pritiska ne smije se okinuti i obični dodir (npr. zvuk bloka).
    wasLongPress: () => {
      const v = longPress.current
      longPress.current = false
      return v
    },
  }
  return (
    <MagnifyContext.Provider value={value}>
      <div
        className="contents"
        onClickCapture={(e) => {
          if (!value.wasLongPress()) return
          e.stopPropagation()
          e.preventDefault()
        }}
      >
        {children}
      </div>
      {shown?.sticky && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 p-6"
          onClick={() => setShown(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="max-h-full w-80 max-w-full overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <WordCard key={shown.char + (shown.word?.text ?? '')} shown={shown} />
          </div>
        </div>
      )}
      {shown && !shown.sticky && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: Math.max(8, Math.min((shown.x ?? 0) - 160, window.innerWidth - 328)), top: Math.max(8, (shown.y ?? 0) - 12), transform: 'translateY(-100%)' }}
        >
          <div className="w-80 max-w-full rounded-3xl bg-white shadow-2xl">
            <WordCard key={shown.char + (shown.word?.text ?? '')} shown={shown} />
          </div>
        </div>
      )}
    </MagnifyContext.Provider>
  )
}

function useData() {
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    void loadData().then(setData)
  }, [])
  return data
}

// Prvo značenje kanjija (kratko, za gumb).
const shortMeaning = (info?: KanjiInfo) => info?.meanings.split(';')[0].trim() ?? ''

// Kartica riječi: riječ gore, njeni kanjiji ispod; kod riječi s jednim kanjijem odmah i detalji.
function WordCard({ shown }: { shown: Shown }) {
  const data = useData()
  const word = shown.word ?? { text: shown.char }
  const chars = [...new Set([...word.text].filter((c) => KANJI.test(c)))]
  const [open, setOpen] = useState<string | null>(chars.length === 1 ? chars[0] : null)
  const meaning = word.meaning ?? data?.words.find((w) => w.word === word.text)?.hr
  const reading = word.reading ?? data?.words.find((w) => w.word === word.text)?.reading
  return (
    <div className="p-5 text-left" lang="hr">
      {shown.word ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span lang="ja" className="text-5xl leading-tight font-medium">
              {word.text}
            </span>
            {reading && reading !== word.text && (
              <span>
                <span lang="ja" className="text-xl text-stone-600">
                  {reading}
                </span>{' '}
                <span className="text-stone-500 italic">{word.romaji ?? toRomaji(reading)}</span>
              </span>
            )}
          </div>
          {meaning && <p className="mt-2 text-lg">{meaning}</p>}
          {chars.length > 1 && (
            <>
              <p className="mt-4 border-t pt-3 text-sm font-semibold text-stone-500">Kanjiji u riječi:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {chars.map((c) => (
                  <button
                    key={c}
                    onClick={() => setOpen(open === c ? null : c)}
                    className={`rounded-xl px-3 py-2 text-left ${open === c ? 'bg-stone-800 text-white' : 'bg-stone-100 active:bg-stone-200'}`}
                  >
                    <span lang="ja" className="text-2xl">
                      {c}
                    </span>{' '}
                    <span lang="en" className="text-sm">
                      {c === '々' ? 'ponavljanje' : shortMeaning(data?.kanji[c])}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {open && (
            <div className={chars.length > 1 ? 'mt-3' : 'mt-4 border-t pt-3'}>
              <KanjiDetails char={open} data={data} />
            </div>
          )}
        </>
      ) : (
        <KanjiDetails char={shown.char} data={data} />
      )}
    </div>
  )
}

// Detalji jednog kanjija: znak, razina, čitanja, značenje, riječi.
function KanjiDetails({ char, data }: { char: string; data: Data | null }) {
  const info = data?.kanji[char]
  const words = data ? data.words.filter((w) => w.word.includes(char)).slice(0, 5) : []
  const reading = (r: string) => (
    <span key={r} className="mr-3 inline-block">
      <span lang="ja">{r}</span> <span className="text-stone-500 italic">({toRomaji(r.replace(/[.-]/g, ''))})</span>
    </span>
  )
  return (
    <>
      <div className="flex items-start justify-between">
        <span lang="ja" className="text-6xl leading-none font-medium">
          {char}
        </span>
        {info && <span className="rounded-full bg-stone-800 px-3 py-1 text-xs font-semibold text-white">{info.level}</span>}
      </div>
      {char === '々' ? (
        <p className="mt-3 text-stone-700">Znak ponavljanja: ponavlja prethodni kanji (人々 = ひとびと, ljudi).</p>
      ) : !data ? (
        <p className="mt-3 text-stone-400">Učitavam…</p>
      ) : (
        <>
          {info ? (
            <>
              {info.on.length > 0 && (
                <p className="mt-3">
                  <span className="font-semibold">On: </span>
                  {info.on.map(reading)}
                </p>
              )}
              {info.kun.length > 0 && (
                <p className="mt-1">
                  <span className="font-semibold">Kun: </span>
                  {info.kun.map(reading)}
                </p>
              )}
              <p className="mt-2">
                <span className="font-semibold">Značenje: </span>
                <span lang="en">{info.meanings.replace(/;\s*/g, ', ')}</span>
              </p>
            </>
          ) : (
            <p className="mt-3 text-stone-500">Ovaj kanji nije na JLPT popisima, pa nema podataka o čitanjima.</p>
          )}
          {words.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold">Riječi:</p>
              <ul className="mt-1 text-sm">
                {words.map((w) => (
                  <li key={w.word + w.reading}>
                    <span lang="ja">{w.word}</span> <span lang="ja" className="text-stone-500">{w.reading}</span>{' '}
                    <span className="text-stone-500 italic">{toRomaji(w.reading)}</span> · {w.hr}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  )
}

// Tekst u kojem svaki kanji ima karticu. `word` = riječ kojoj tekst pripada (kartica tad pokaže cijelu riječ).
export function KanjiText({ text, word }: { text: string; word?: WordContext }) {
  const magnify = useContext(MagnifyContext)
  const timer = useRef<number | undefined>(undefined)
  if (!magnify) return <>{text}</>
  return (
    <>
      {[...text].map((ch, i) =>
        KANJI.test(ch) ? (
          <span
            key={i}
            className="select-none [-webkit-touch-callout:none] hover:rounded-md hover:bg-amber-100"
            onContextMenu={(e) => e.preventDefault()}
            onPointerEnter={(e) => {
              if (e.pointerType !== 'mouse') return
              const r = e.currentTarget.getBoundingClientRect()
              magnify.show({ char: ch, word, sticky: false, x: r.left + r.width / 2, y: r.top })
            }}
            onPointerLeave={(e) => {
              window.clearTimeout(timer.current)
              if (e.pointerType === 'mouse') magnify.hide(true)
            }}
            onPointerDown={(e) => {
              if (e.pointerType !== 'touch') return
              timer.current = window.setTimeout(() => magnify.show({ char: ch, word, sticky: true }), LONG_PRESS_MS)
            }}
            onPointerUp={() => window.clearTimeout(timer.current)}
            onPointerCancel={() => window.clearTimeout(timer.current)}
          >
            {ch}
          </span>
        ) : (
          ch
        ),
      )}
    </>
  )
}
