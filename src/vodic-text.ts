// Nazivi koraka i kratki opisi rečenica za vodič (početni zaslon i zaslon treninga).
import { stories } from './stories'
import type { StepId } from './vodic-config'
import type { SentenceRef, StoryInfo } from './vodic-plan'

export const STEP_TITLE: Record<StepId, string> = {
  rijeci: 'Ponavljanje riječi',
  zagrijavanje: 'Zagrijavanje',
  nove: 'Nove rečenice',
  cisto: 'Čisto test',
  konjugator: 'Konjugator',
  'nove-rijeci': 'Nove riječi',
  citanje: 'Čitanje',
  dorada: 'Dorada rečenica u radu',
  'test-price': 'Test cijele priče',
}

export const STORY_INFO: StoryInfo[] = stories.map((s) => ({ id: s.id, sentenceCount: s.sentences.length }))

export const titleOf = (id: string) => stories.find((s) => s.id === id)?.title_ja ?? id
export const sentenceJa = (storyId: string, index: number) =>
  stories.find((s) => s.id === storyId)?.sentences[index]?.ja ?? ''

// "九州旅行 1, 2 · 京都の旅行 3"
export function listOf(refs: SentenceRef[]) {
  if (!refs.length) return ''
  const groups = new Map<string, number[]>()
  for (const r of refs) groups.set(r.storyId, [...(groups.get(r.storyId) ?? []), r.index + 1])
  return [...groups].map(([sid, xs]) => `${titleOf(sid)} ${xs.join(', ')}`).join(' · ')
}
