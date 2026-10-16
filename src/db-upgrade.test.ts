// Nadogradnja baze na mobitelu: jednokratno brisanje probnih sesija. Pokretanje: npm test
import 'fake-indexeddb/auto'
import { Dexie } from 'dexie'
import { expect, it } from 'vitest'
it('nadogradnja briše samo probne sesije', async () => {
  // Stara baza (verzija 8) s jednom probnom i jednom pravom sesijom.
  const old = new Dexie('nihongo')
  old.version(8).stores({ sessionLogs: 'id, startedAt', myWords: 'id, addedAt' })
  await old.open()
  await old.table('sessionLogs').bulkPut([
    { id: 'proba', v: 1, startedAt: 1, endedAt: 2, minutes: 5, blocks: [], storyId: 'x' },
    { id: 'prava', v: 1, startedAt: 3, endedAt: 4, minutes: 5, blocks: [], storyId: 'x', blockIndex: 1, blockStartedAt: 3 },
  ])
  await old.table('myWords').put({ id: 'a|a', addedAt: 1 })
  old.close()
  const { db } = await import('./db')
  expect((await db.sessionLogs.toArray()).map((s) => s.id)).toEqual(['prava'])
  expect(await db.myWords.count()).toBe(1)
  expect(db.verno).toBe(9)
})
