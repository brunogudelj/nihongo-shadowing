// Baza u pregledniku (IndexedDB, preko Dexie): tvoje riječi, a kasnije i FSRS kartice.
// Sve ostaje na mobitelu; ništa ne ide na internet.
import { Dexie, type EntityTable } from 'dexie'

export type MyWord = {
  id: string // riječ|čitanje
  word: string
  reading: string
  hr: string
  source: string // odakle je dodana: rijeci, prica, konjugator
  addedAt: number
}

export const db = new Dexie('nihongo') as Dexie & { myWords: EntityTable<MyWord, 'id'> }
db.version(1).stores({ myWords: 'id, addedAt' })

export const wordId = (word: string, reading: string) => `${word}|${reading}`

// Traži od preglednika trajnu pohranu, da Firefox ne obriše napredak kad mu treba mjesta.
export async function askPersist(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}

export async function addMyWord(w: Omit<MyWord, 'id' | 'addedAt'>) {
  await db.myWords.put({ ...w, id: wordId(w.word, w.reading), addedAt: Date.now() })
  void askPersist()
}

export async function removeMyWord(id: string) {
  await db.myWords.delete(id)
}
