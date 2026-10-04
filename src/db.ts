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
export type SentenceState = {
  id: string
  storyId: string
  index: number
  status: SentenceStatus
  updatedAt: number
  // Vodič (1V): dan kad je prošla fazu D, dan kad je postala gotova, rok i korak ponavljanja,
  // broj neuspjeha i treba li sutra prva (dvaput pala fazu D).
  dPassedOn?: string
  doneOn?: string
  due?: string
  intervalIdx?: number
  fails?: number
  retryFirst?: boolean
}

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

// Stanje vodiča (1V): tekuća priča, red konjugatora, pravilo treće rečenice.
export type VodicState = {
  id: 'stanje'
  v: 1
  storyIndex: number
  storyStartedOn: string
  konjRow: number
  konjRowSince?: number // od kad je tekući red konjugatora (ms), za brojanje sesija
  thirdFailStreak: number
  thirdBackoffUntil?: string
  startDate?: string // prvi dan vodiča, ako je pokrenut ranije od zadanog ("Kreni danas")
}

// Dnevnik dana vodiča: plan, odrađeni koraci, skraćeni plan, vrijeme čitanja.
export type DayLog = {
  date: string
  v: 1
  short: boolean
  steps: string[]
  done: string[]
  readingSec?: number
  plan?: unknown // plan dana zamrznut pri pokretanju (vodic-plan.ts, Plan)
  stepIndex?: number // gdje je trening stao (za Nastavi)
  stepStartedAt?: number
  extra?: { storyId: string; index: number }[] // treća rečenica, ako je uzeta
  progress?: DayProgress // dokle se stiglo unutar tekućeg koraka (briše se na idućem koraku)
}
export type DayProgress = {
  item?: number // redni broj stavke u koraku (riječ, rečenica, pitanje)
  wordIds?: string[] // popis riječi za ponavljanje, zamrznut na početku koraka
  phase?: 'A' | 'B' | 'C' | 'D'
  dTries?: number // koliko je puta faza D već pala za tekuću rečenicu
  asking?: boolean // pitanja na kraju faze D
  q?: number // koje pitanje faze D
  stopped?: boolean // rečenica je dvaput pala fazu D: danas nema drugih
  fastPass?: boolean // obje nove prošle D unutar 15 min (nudi se treća)
  failed?: number[] // subota: neuspjele rečenice
  result?: string // poruka nakon odluke
}

// Ponavljanje riječi u vodiču (korak 1): koliko je puta zaredom i ukupno bilo "Nisam".
export type WordReview = { id: string; v: 1; nisamStreak: number; nisamTotal: number; lastOn: string; priorityOn?: string }

export const db = new Dexie('nihongo') as Dexie & {
  myWords: EntityTable<MyWord, 'id'>
  sentences: EntityTable<SentenceState, 'id'>
  places: EntityTable<Place, 'storyId'>
  conjAttempts: EntityTable<ConjAttempt, 'id'>
  vodic: EntityTable<VodicState, 'id'>
  days: EntityTable<DayLog, 'date'>
  wordReviews: EntityTable<WordReview, 'id'>
}
db.version(1).stores({ myWords: 'id, addedAt' })
db.version(2).stores({ myWords: 'id, addedAt', sentences: 'id, storyId', places: 'storyId, updatedAt' })
db.version(3).stores({
  myWords: 'id, addedAt',
  sentences: 'id, storyId',
  places: 'storyId, updatedAt',
  conjAttempts: 'id, at, point, word, session',
})
db.version(4).stores({
  myWords: 'id, addedAt',
  sentences: 'id, storyId',
  places: 'storyId, updatedAt',
  conjAttempts: 'id, at, point, word, session',
  vodic: 'id',
  days: 'date',
})
db.version(5).stores({
  myWords: 'id, addedAt',
  sentences: 'id, storyId',
  places: 'storyId, updatedAt',
  conjAttempts: 'id, at, point, word, session',
  vodic: 'id',
  days: 'date',
  wordReviews: 'id',
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
