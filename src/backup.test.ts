// @vitest-environment happy-dom
// Testovi za sigurnosnu kopiju (dorada 1). Pokretanje: npm test
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, applyBackup, buildBackup, parseBackup, type Backup } from './backup'
import { db, type SentenceStatus } from './db'
import { readSetting, writeSetting } from './settings'

const word = (w: string, r: string, hr = '') => ({ id: `${w}|${r}`, word: w, reading: r, hr, source: 'rijeci', addedAt: 1 })
const status = (story: string, i: number, s: SentenceStatus) => ({ id: `${story}:${i}`, storyId: story, index: i, status: s, updatedAt: 1 })

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.clear()
})

describe('format', () => {
  it('izvoz ima formatVersion 2, tablice i postavke', async () => {
    await db.myWords.put(word('駅', 'えき'))
    writeSetting('brzina', '0.85')
    const b = await buildBackup()
    expect(b.formatVersion).toBe(2)
    expect(b.tables.myWords).toHaveLength(1)
    expect(b.settings.brzina).toBe('0.85')
  })

  it('stara datoteka (verzija 1, bez formatVersion) se migrira', () => {
    const v1 = { app: APP, version: 2, exportedAt: '2026-10-04T10:00:00Z', tables: { myWords: [word('駅', 'えき')] } }
    const b = parseBackup(JSON.stringify(v1))
    expect(b.formatVersion).toBe(2)
    expect(b.tables.myWords).toHaveLength(1)
    expect(b.settings).toEqual({})
  })

  it('novija verzija se odbija s jasnom porukom', () => {
    expect(() => parseBackup(JSON.stringify({ app: APP, formatVersion: 99, tables: {} }))).toThrow(/novije verzije/)
  })

  it('neispravna datoteka se odbija i ništa ne mijenja', async () => {
    await db.myWords.put(word('駅', 'えき'))
    expect(() => parseBackup('ovo nije json')).toThrow(/nije JSON/)
    expect(() => parseBackup(JSON.stringify({ app: 'drugo', tables: {} }))).toThrow(/ove aplikacije/)
    expect(() => parseBackup(JSON.stringify({ app: APP, formatVersion: 2, tables: { myWords: 'x' } }))).toThrow(/oštećena/)
    expect(await db.myWords.count()).toBe(1)
  })
})

describe('uvoz', () => {
  const file = (): Backup => ({
    app: APP,
    formatVersion: 2,
    exportedAt: '2026-10-04T10:00:00Z',
    tables: {
      myWords: [word('駅', 'えき', 'stanica'), word('電車', 'でんしゃ', 'vlak')],
      sentences: [status('kyushu-001', 0, 'nova')],
    },
    settings: { brzina: '0.7', stanka: '2' },
  })

  it('spoji dvaput ne stvara duplikate', async () => {
    await applyBackup(file(), 'spoji')
    await applyBackup(file(), 'spoji')
    expect(await db.myWords.count()).toBe(2)
    expect(await db.sentences.count()).toBe(1)
  })

  it('spoji ne dira postojeće podatke i postavke', async () => {
    await db.sentences.put(status('kyushu-001', 0, 'gotova'))
    writeSetting('brzina', '1')
    const counts = await applyBackup(file(), 'spoji')
    expect((await db.sentences.get('kyushu-001:0'))?.status).toBe('gotova')
    expect(readSetting('brzina')).toBe('1') // postojeća ostaje
    expect(readSetting('stanka')).toBe('2') // nedostajuća se dodaje
    expect(counts.myWords).toBe(2)
    expect(counts.sentences ?? 0).toBe(0)
  })

  it('zamijeni briše trenutno i stavlja kopiju', async () => {
    await db.myWords.put(word('猫', 'ねこ'))
    await db.sentences.put(status('kyushu-001', 0, 'gotova'))
    writeSetting('brzina', '1')
    await applyBackup(file(), 'zamijeni')
    expect(await db.myWords.get('猫|ねこ')).toBeUndefined()
    expect(await db.myWords.count()).toBe(2)
    expect((await db.sentences.get('kyushu-001:0'))?.status).toBe('nova')
    expect(readSetting('brzina')).toBe('0.7')
  })

  it('izvezi, obriši, uvezi: sve je natrag', async () => {
    await db.myWords.put(word('駅', 'えき', 'stanica'))
    await db.sentences.put(status('kyushu-001', 2, 'u-radu'))
    await db.places.put({ storyId: 'kyushu-001', index: 2, updatedAt: 5 })
    writeSetting('prikaz', 'cisto')
    const text = JSON.stringify(await buildBackup())

    await Promise.all(db.tables.map((t) => t.clear()))
    localStorage.clear()

    await applyBackup(parseBackup(text), 'spoji')
    expect((await db.myWords.get('駅|えき'))?.hr).toBe('stanica')
    expect((await db.sentences.get('kyushu-001:2'))?.status).toBe('u-radu')
    expect((await db.places.get('kyushu-001'))?.index).toBe(2)
    expect(readSetting('prikaz')).toBe('cisto')
  })
})
