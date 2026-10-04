// Baza u pregledniku (IndexedDB, preko Dexie): tvoje riječi, a kasnije i FSRS kartice.
// Sve ostaje na mobitelu; ništa ne ide na internet.
import { Dexie, type EntityTable } from 'dexie'

export type MyWord = {
  id: string // riječ|čitanje
  word: string
  reading: string
  hr: string
  source: string // odakle je dodana: rijeci, prica, konjugator, rucno (upisana sama, još bez izgovora)
  addedAt: number
}

// Status rečenice u priči, koji korisnik sam označava.
export type SentenceStatus = 'nova' | 'u-radu' | 'gotova'
export type SentenceState = { id: string; storyId: string; index: number; status: SentenceStatus; updatedAt: number }

// Gdje je korisnik stao u priči (zadnja otvorena rečenica).
export type Place = { storyId: string; index: number; updatedAt: number }

// Jedan odgovor u konjugatoru (dorada 1K). `v` je verzija zapisa, za buduće migracije.
// `point` = oblik|oznaka pravila (npr. "te|godan-く"): po njemu se računaju slabe točke.
export type ConjAttempt = {
  id: string
  v: 1
  at: number
  word: string
  reading: string
  wordClass: string // godan, ichidan, nepravilni, i-pridjev, na-pridjev
  form: string
  point: string
  rule: string // kratki opis pravila, npr. "godan ～く → ～いて"
  direction: 'proizvodnja' | 'obrnuto' | 'na-sluh'
  source: 'slobodno' | 'vodic'
  session: string
  result: 'znao' | 'nisam'
}

export const db = new Dexie('nihongo') as Dexie & {
  myWords: EntityTable<MyWord, 'id'>
  sentences: EntityTable<SentenceState, 'id'>
  places: EntityTable<Place, 'storyId'>
  conjAttempts: EntityTable<ConjAttempt, 'id'>
}
db.version(1).stores({ myWords: 'id, addedAt' })
db.version(2).stores({ myWords: 'id, addedAt', sentences: 'id, storyId', places: 'storyId, updatedAt' })
db.version(3).stores({
  myWords: 'id, addedAt',
  sentences: 'id, storyId',
  places: 'storyId, updatedAt',
  conjAttempts: 'id, at, point, word, session',
})

export const sentenceId = (storyId: string, index: number) => `${storyId}:${index}`

export async function setSentenceStatus(storyId: string, index: number, status: SentenceStatus) {
  await db.sentences.put({ id: sentenceId(storyId, index), storyId, index, status, updatedAt: Date.now() })
  void askPersist()
}

export async function savePlace(storyId: string, index: number) {
  await db.places.put({ storyId, index, updatedAt: Date.now() })
}

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
