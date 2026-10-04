// Slabe točke i sesije konjugatora (dorada 1K), iz zapisanih odgovora. Čiste funkcije, bez baze.
// Svi odgovori vrijede jednako, bez obzira jesu li iz vodiča ili iz slobodnog vježbanja.
import type { ConjAttempt } from './db'
import { KONJUGATOR as C } from './vodic-config'

type A = Pick<ConjAttempt, 'at' | 'point' | 'word' | 'result' | 'session' | 'form' | 'rule' | 'id'>

const byTime = <T extends { at: number }>(xs: T[]) => [...xs].sort((a, b) => a.at - b.at)
const fails = (xs: A[]) => xs.filter((x) => x.result === 'nisam').length

export type WeakPoint = { point: string; form: string; rule: string; example: string; recentFails: number; recentCount: number }

// Je li točka slaba nakon niza odgovora (od najstarijeg prema najnovijem).
// Postaje slaba kad je zadnji odgovor "Nisam" i u zadnjih 20 je barem 5 pokušaja s barem 30 % "Nisam";
// prestaje kad je zadnjih 10 barem 90 % "Znao". Tako 10 točnih zaredom stvarno makne točku.
export function isWeak(history: A[]): boolean {
  let weak = false
  for (let i = 0; i < history.length; i++) {
    const upto = history.slice(0, i + 1)
    if (weak) {
      const last = upto.slice(-C.recover.window)
      if (last.length >= C.recover.window && (last.length - fails(last)) / last.length >= C.recover.okRate) weak = false
    } else if (history[i].result === 'nisam') {
      const last = upto.slice(-C.weak.window)
      if (last.length >= C.weak.minAttempts && fails(last) / last.length >= C.weak.failRate) weak = true
    }
  }
  return weak
}

// Slabe točke (oblik + pravilo), najslabije prve.
export function weakPoints(attempts: A[]): WeakPoint[] {
  const groups = new Map<string, A[]>()
  for (const a of byTime(attempts)) groups.set(a.point, [...(groups.get(a.point) ?? []), a])
  const out: WeakPoint[] = []
  for (const [point, history] of groups) {
    if (!isWeak(history)) continue
    const last = history.slice(-C.weak.window)
    const lastFail = [...history].reverse().find((x) => x.result === 'nisam') ?? history[history.length - 1]
    out.push({
      point,
      form: lastFail.form,
      rule: lastFail.rule,
      example: lastFail.word,
      recentFails: fails(last),
      recentCount: last.length,
    })
  }
  return out.sort((a, b) => b.recentFails / b.recentCount - a.recentFails / a.recentCount)
}

// Slabe riječi: barem 2 "Nisam" u zadnja 3 odgovora te riječi.
export function weakWords(attempts: A[]): { word: string; recentFails: number }[] {
  const groups = new Map<string, A[]>()
  for (const a of byTime(attempts)) groups.set(a.word, [...(groups.get(a.word) ?? []), a])
  const out: { word: string; recentFails: number }[] = []
  for (const [word, history] of groups) {
    const last = history.slice(-C.weakWord.window)
    if (fails(last) >= C.weakWord.fails) out.push({ word, recentFails: fails(last) })
  }
  return out.sort((a, b) => b.recentFails - a.recentFails)
}

export type Session = { session: string; startedAt: number; answers: number; known: number; passed: boolean }

// Sesije (otvaranja konjugatora) s barem 10 odgovora, od najstarije. Neobavezno samo za zadane oblike
// (vodič broji sesije u oblicima tekućeg reda tablice).
export function sessions(attempts: A[], forms?: string[]): Session[] {
  const groups = new Map<string, A[]>()
  for (const a of byTime(attempts)) {
    if (forms && !forms.includes(a.form)) continue
    groups.set(a.session, [...(groups.get(a.session) ?? []), a])
  }
  return [...groups.entries()]
    .map(([session, xs]) => {
      const known = xs.length - fails(xs)
      return { session, startedAt: xs[0].at, answers: xs.length, known, passed: known / xs.length >= C.session.passRate }
    })
    .filter((s) => s.answers >= C.session.minAnswers)
    .sort((a, b) => a.startedAt - b.startedAt)
}

// Koje zapise obrisati kad ih je previše: najstarije, ali po točki i po riječi ostaje zadnjih `keepPerPoint`.
export function pruneIds(attempts: A[]): string[] {
  if (attempts.length <= C.maxRecords) return []
  const keep = new Set<string>()
  const lastOf = (key: (a: A) => string) => {
    const groups = new Map<string, A[]>()
    for (const a of byTime(attempts)) groups.set(key(a), [...(groups.get(key(a)) ?? []), a])
    for (const xs of groups.values()) for (const a of xs.slice(-C.keepPerPoint)) keep.add(a.id)
  }
  lastOf((a) => a.point)
  lastOf((a) => a.word)
  const sorted = byTime(attempts)
  const toDelete: string[] = []
  let remaining = attempts.length
  for (const a of sorted) {
    if (remaining <= C.maxRecords) break
    if (keep.has(a.id)) continue
    toDelete.push(a.id)
    remaining--
  }
  return toDelete
}
