// Kartica kanjija: veliki znak, čitanja (on/kun) s romajijem, značenje i riječi u kojima se pojavljuje.
// Na računalu se pokaže na hover, na mobitelu na dugi pritisak (ostaje otvorena dok se ne dodirne).
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

// Kartica: gdje (pokraj kanjija na računalu, ili na sredini na mobitelu) i koji znak.
type Shown = { char: string; sticky: boolean; x?: number; y?: number }
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
          <KanjiCard char={shown.char} />
        </div>
      )}
      {shown && !shown.sticky && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: Math.max(8, Math.min((shown.x ?? 0) - 160, window.innerWidth - 328)), top: Math.max(8, (shown.y ?? 0) - 12), transform: 'translateY(-100%)' }}
        >
          <KanjiCard char={shown.char} />
        </div>
      )}
    </MagnifyContext.Provider>
  )
}

function KanjiCard({ char }: { char: string }) {
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    void loadData().then(setData)
  }, [])
  const info = data?.kanji[char]
  const words = data ? data.words.filter((w) => w.word.includes(char)).slice(0, 5) : []
  const reading = (r: string) => (
    <span key={r} className="mr-3 inline-block">
      <span lang="ja">{r}</span> <span className="text-stone-500 italic">({toRomaji(r.replace(/[.-]/g, ''))})</span>
    </span>
  )
  return (
    <div className="w-80 max-w-full rounded-3xl bg-white p-5 text-left shadow-2xl" lang="hr">
      <div className="flex items-start justify-between">
        <span lang="ja" className="text-7xl leading-none font-medium">
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
    </div>
  )
}

// Tekst u kojem svaki kanji ima karticu.
export function KanjiText({ text }: { text: string }) {
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
              magnify.show({ char: ch, sticky: false, x: r.left + r.width / 2, y: r.top })
            }}
            onPointerLeave={(e) => {
              window.clearTimeout(timer.current)
              if (e.pointerType === 'mouse') magnify.hide(true)
            }}
            onPointerDown={(e) => {
              if (e.pointerType !== 'touch') return
              timer.current = window.setTimeout(() => magnify.show({ char: ch, sticky: true }), LONG_PRESS_MS)
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
