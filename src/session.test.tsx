// @vitest-environment happy-dom
// Zaslon kratke sesije u simuliranom pregledniku: prolazak kroz blokove, sesija od 5 minuta, isteklo vrijeme.
// Pokretanje: npm test
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { saveRating } from './cards'
import { db } from './db'
import { writeSetting } from './settings'
import TodayPlan from './TodayPlan'
import { SessionRun } from './Training'
import type { BlockId } from './vodic-config'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const MIN = 60_000

let el: HTMLDivElement
let root: Root
const text = () => el.textContent ?? ''
const buttons = () => [...el.querySelectorAll('button')]
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 40 && !cond(); i++) await act(() => wait(50))
}
const click = async (label: string) => {
  await until(() => buttons().some((b) => b.textContent?.includes(label)))
  const b = buttons().find((x) => x.textContent?.includes(label))
  if (!b) throw new Error(`Nema gumba "${label}" u: ${text()}`)
  await act(async () => {
    b.click()
    await wait(50)
  })
}

// Sesija s danim blokovima; `ago` = koliko je minuta prošlo od početka bloka.
async function openSession(blocks: BlockId[], minutes: number, ago = 0) {
  const startedAt = Date.now() - ago * MIN
  await db.sessionLogs.put({ id: 's', v: 1, startedAt, minutes, blocks, storyId: 'kyushu-001', blockIndex: 0, blockStartedAt: startedAt, progress: {} })
  await act(async () => root.render(<SessionRun id="s" onBack={() => {}} />))
  await until(() => text().includes('Blok 1 /'))
}

const word = (w: string, r: string, hr: string, addedAt = 1) => ({ id: `${w}|${r}`, word: w, reading: r, hr, source: 'rijeci', addedAt })

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.clear()
  el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
})
afterEach(() => {
  act(() => root.unmount())
  el.remove()
})

it('sesija od 15 min ide kroz blokove, sprema ocjene i na kraju se broji', async () => {
  await db.myWords.put(word('駅', 'えき', 'postaja'))
  await saveRating('fraza', 'kyushu-001:0', false, undefined, Date.now() - 60 * MIN) // fraza na redu
  await openSession(['rijeci', 'fraze', 'nova-recenica'], 15)
  expect(text()).toContain('Blok 1 / 3')

  // Riječi: Pokaži → značenje → Znao.
  await click('Pokaži')
  expect(text()).toContain('postaja')
  await click('Znao')
  await until(() => text().includes('Sve riječi na redu su ponovljene'))
  await click('Blok gotov')

  // Fraze: jedna na redu, Da.
  await until(() => text().includes('Blok 2 / 3'))
  await click('Da')
  await click('Blok gotov')

  // Nova rečenica: upoznaj + 3 kruga, pa tri pitanja.
  await until(() => text().includes('Blok 3 / 3'))
  for (let i = 0; i < 4; i++) await click('Gotovo')
  for (let i = 0; i < 3; i++) await click('Da')
  await until(() => text().includes('dobila karticu'))
  await click('sažetak')

  await until(() => text().includes('Sesija je gotova'))
  expect(text()).toContain('Riječi: novih 1')
  expect(text()).toContain('Fraze: ponovljeno 1, novih 1')
  expect((await db.sessionLogs.get('s'))?.endedAt).toBeDefined()
  expect((await db.cards.toArray()).map((c) => c.id).sort()).toEqual(['fraza:kyushu-001:0', 'fraza:kyushu-001:1', 'rijec:駅|えき'])
})

it('5 min na početnom zaslonu: uvijek jedan blok od 5 minuta, i sesija se odmah otvara', async () => {
  await db.myWords.put(word('駅', 'えき', 'postaja'))
  await saveRating('fraza', 'kyushu-001:0', false, undefined, Date.now() - 60 * MIN)
  writeSetting('sesija-trajanje', '5')
  const opened: string[] = []
  await act(async () => root.render(<TodayPlan onOpen={(id) => opened.push(id)} />))
  const seen = new Set<string>()
  for (let k = 0; k < 15; k++) {
    await click('Započni sesiju')
    await until(() => opened.length === k + 1)
    const log = (await db.sessionLogs.get(opened[k]))!
    expect(log.minutes).toBe(5)
    expect(log.blocks).toHaveLength(1)
    expect(['nova-recenica', 'prica']).not.toContain(log.blocks[0]) // dugi blokovi ne stanu
    seen.add(log.blocks[0])
    await click('Odustani od sesije')
  }
  expect(seen.size).toBeGreaterThan(2) // svaki put drugi blok
})

// Svaki kratki blok kao sesija od 5 minuta: tajmer 5:00, jedan blok, gumb vodi na sažetak.
for (const block of ['rijeci', 'fraze', 'konjugator', 'citanje', 'nove-rijeci'] as BlockId[]) {
  it(`sesija od 5 min s blokom ${block} radi i završava sažetkom`, async () => {
    await db.myWords.put(word('駅', 'えき', 'postaja'))
    await saveRating('fraza', 'kyushu-001:0', false, undefined, Date.now() - 60 * MIN)
    await openSession([block], 5)
    expect(text()).toContain('Blok 1 / 1 · 5 min')
    expect(text()).toContain('5:00')
    expect(text()).not.toContain('sesija 5:00') // kod jednog bloka nema drugog sata
    await click('Blok gotov → sažetak')
    await until(() => text().includes('Sesija je gotova'))
    expect((await db.sessionLogs.get('s'))?.endedAt).toBeDefined()
  })
}

it('Riječi: kad istekne 5 minuta, dovršiš riječ i blok staje', async () => {
  await db.myWords.bulkPut([word('駅', 'えき', 'postaja', 3), word('山', 'やま', 'planina', 2), word('川', 'かわ', 'rijeka', 1)])
  await openSession(['rijeci'], 5, 6) // blok je počeo prije 6 minuta
  await until(() => text().includes('Riječ 1 / 3'))
  expect(text()).toContain('Vrijeme je isteklo')
  await click('Pokaži')
  await click('Nisam')
  await until(() => text().includes('Vrijeme bloka je isteklo'))
  expect(text()).toContain('Ponovljeno: 1 od 3')
  expect(await db.cardLogs.count()).toBe(1) // ocjena je spremljena
})

it('Fraze: kad istekne 5 minuta, blok staje nakon tekuće rečenice', async () => {
  for (const i of [0, 1, 2]) await saveRating('fraza', `kyushu-001:${i}`, false, undefined, Date.now() - 60 * MIN)
  await openSession(['fraze'], 5, 6)
  await click('Da')
  await until(() => text().includes('Vrijeme bloka je isteklo'))
  expect(text()).toContain('Ponovljeno: 1 od 3')
})
