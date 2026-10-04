// Povećalo za kanji: na računalu se kanji poveća na hover, na mobitelu na dugi pritisak
// (veliki znak na sredini zaslona dok se prst ne makne).
import { createContext, useContext, useRef, useState, type ReactNode } from 'react'

const KANJI = /[㐀-䶿一-鿿々]/
const LONG_PRESS_MS = 400

type Magnify = { show: (char: string) => void; hide: () => void; wasLongPress: () => boolean }
const MagnifyContext = createContext<Magnify | null>(null)

// Omotaj zaslon: prikazuje povećani znak i pamti je li zadnji dodir bio dugi pritisak.
export function KanjiMagnifier({ children }: { children: ReactNode }) {
  const [char, setChar] = useState<string | null>(null)
  const longPress = useRef(false)
  const value: Magnify = {
    show: (c) => {
      longPress.current = true
      setChar(c)
    },
    hide: () => setChar(null),
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
      {char && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-stone-900/20">
          <span lang="ja" className="rounded-3xl bg-white px-8 py-4 text-[11rem] leading-none font-medium shadow-2xl">
            {char}
          </span>
        </div>
      )}
    </MagnifyContext.Provider>
  )
}

// Tekst u kojem se svaki kanji može povećati.
export function KanjiText({ text }: { text: string }) {
  const magnify = useContext(MagnifyContext)
  const timer = useRef<number | undefined>(undefined)
  const release = () => {
    window.clearTimeout(timer.current)
    magnify?.hide()
  }
  return (
    <>
      {[...text].map((ch, i) =>
        KANJI.test(ch) ? (
          <span
            key={i}
            className="inline-block origin-bottom select-none [-webkit-touch-callout:none] hover:relative hover:z-20 hover:scale-[2.5] hover:rounded-md hover:bg-white hover:shadow-lg motion-safe:transition-transform"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              if (e.pointerType !== 'touch' || !magnify) return
              timer.current = window.setTimeout(() => magnify.show(ch), LONG_PRESS_MS)
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onPointerLeave={() => window.clearTimeout(timer.current)}
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
