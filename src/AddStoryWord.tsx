// ☆ za riječ iz priče: sprema osnovni oblik (行きました → 行く) s čitanjem i značenjem s popisa riječi.
// Ako riječi nema na popisu (npr. ime mjesta), sprema riječ iz priče i prvu rečenicu objašnjenja.
import { useEffect, useState } from 'react'
import AddWord from './AddWord'
import type { Word } from './stories'

type Entry = { word: string; reading: string; hr: string }
let listPromise: Promise<Map<string, Entry>> | null = null
const loadList = () =>
  (listPromise ??= import('../data/rijeci.json').then((m) => {
    const map = new Map<string, Entry>()
    for (const e of m.default as Entry[]) if (!map.has(e.word)) map.set(e.word, e)
    return map
  }))

export default function AddStoryWord({ w }: { w: Word }) {
  const [entry, setEntry] = useState<Entry | null>(null)
  useEffect(() => {
    let alive = true
    void loadList().then((map) => {
      if (!alive) return
      const found = map.get(w.lemma) ?? map.get(w.text)
      setEntry(found ?? { word: w.text, reading: w.reading, hr: w.explanation_hr.split(/[.;]/)[0] })
    })
    return () => {
      alive = false
    }
  }, [w])
  if (!entry) return null
  return <AddWord label word={entry.word} reading={entry.reading} hr={entry.hr} source="prica" />
}
