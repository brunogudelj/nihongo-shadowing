// Učitava sve priče iz content/stories/ i njihov zvuk iz content/audio/.
// Nova priča se pojavi u aplikaciji sama, bez izmjene koda.

// kind: čestica, kopula ili nastavak za konjugaciju (za isticanje); bez oznake = osnova riječi.
export type FuriganaPart = { text: string; reading?: string; kind?: 'cestica' | 'kopula' | 'nastavak' }

export type Word = {
  text: string
  lemma: string
  reading: string
  role: string
  explanation_hr: string
  furigana: FuriganaPart[]
  romaji?: string
  start_ms: number
  end_ms: number
}

export type ChunkInfo = { literal_hr: string; role: string }

export type Sentence = {
  ja: string
  hr: string
  chunks: string[]
  chunk_info?: ChunkInfo[]
  words: Word[]
  audio: string
  duration_ms: number
  full_start_ms: number
  full_end_ms: number
}

export type Story = {
  id: string
  theme: string
  title_ja: string
  title_hr: string
  audio: string
  duration_ms: number
  sentences: Sentence[]
}

const storyFiles = import.meta.glob<Story>('../content/stories/*/*.json', { eager: true, import: 'default' })

const audioFiles = import.meta.glob<string>('../content/audio/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const stories: Story[] = Object.values(storyFiles).sort((a, b) => a.id.localeCompare(b.id))

export function audioUrl(name: string): string | undefined {
  return audioFiles[`../content/audio/${name}`]
}
