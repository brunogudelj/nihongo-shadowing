// Oblici: lekcija o te-obliku i svi oblici iz konjugatora za izabranu riječ, na jednom zaslonu.
// Oblici se računaju pravilima (conjugate.ts), kao u konjugatoru; 🔊 pušta izgovor ako postoji.
import { useState } from 'react'
import allWords from '../data/konjugator.json'
import { conjugate, FORMS, kindOf, type ConjWord, type Kind } from './conjugate'
import { CATEGORIES, constructionsByCategory, formExamples, type Example } from './grammar-index'
import { audioUrl, stories } from './stories'
import { chunkSpans } from './timing'
import { readSetting, writeSetting } from './settings'
import { speak } from './speech'
import { BASES, baseFor, stemOf } from './stems'

const WORDS = allWords as ConjWord[]
const byWord = (w: string) => WORDS.find((x) => x.word === w)!

// Te-oblik godan glagola: zadnja kana odlučuje nastavak.
const TE_GODAN = [
  { ends: 'う・つ・る', te: 'って', words: ['会う', '待つ', '帰る'] },
  { ends: 'む・ぶ・ぬ', te: 'んで', words: ['飲む', '遊ぶ', '死ぬ'] },
  { ends: 'く', te: 'いて', words: ['書く'] },
  { ends: 'ぐ', te: 'いで', words: ['泳ぐ'] },
  { ends: 'す', te: 'して', words: ['話す'] },
]
const TE_OTHER = [
  { label: 'ichidan (～る)', note: 'makni る, dodaj て', words: ['食べる', '見る'] },
  { label: 'iznimka', note: '行く → 行って (ne 行いて)', words: ['行く'] },
  { label: 'nepravilni', note: 'する → して, 来る → 来て', words: ['する', '来る'] },
]
// Primjeri po dijelovima: [tekst, čitanje] za kanji, [tekst] za kanu.
const TE_USES: { ja: string; hr: string; ex: [string, string?][]; exHr: string }[] = [
  { ja: '～てください', hr: 'molim te, napravi…', ex: [['待', 'ま'], ['ってください。']], exHr: 'Pričekajte, molim.' },
  { ja: '～ています', hr: 'radnja u tijeku ili stanje', ex: [['雨', 'あめ'], ['が'], ['降', 'ふ'], ['っています。']], exHr: 'Pada kiša.' },
  { ja: '～てもいいです', hr: 'smije se…', ex: [['写真', 'しゃしん'], ['を'], ['撮', 'と'], ['ってもいいですか。']], exHr: 'Smijem li fotografirati?' },
  { ja: '～てから', hr: 'nakon što…', ex: [['ご'], ['飯', 'はん'], ['を'], ['食', 'た'], ['べてから、'], ['出', 'で'], ['かけます。']], exHr: 'Nakon jela izlazim.' },
  { ja: '～て、～', hr: 'veže radnje redom (i zatim)', ex: [['駅', 'えき'], ['へ'], ['行', 'い'], ['って、'], ['電車', 'でんしゃ'], ['に'], ['乗', 'の'], ['りました。']], exHr: 'Otišao sam na stanicu i ušao u vlak.' },
]

// Furigana iz pisanja i čitanja: zajednički kana-nastavak ostaje, kanji dio dobiva čitanje iznad
// (食べます + たべます → 食[た]べます). Bez furigane samo pismo.
function Furi({ written, reading, on }: { written: string; reading: string; on: boolean }) {
  let n = 0
  while (n < written.length && n < reading.length && written.at(-1 - n) === reading.at(-1 - n)) n++
  const head = written.slice(0, written.length - n)
  if (!on || !head || head === reading.slice(0, reading.length - n)) return <>{written}</>
  return (
    <>
      <ruby>
        {head}
        <rt className="text-[0.55em] font-normal text-stone-500">{reading.slice(0, reading.length - n)}</rt>
      </ruby>
      {written.slice(written.length - n)}
    </>
  )
}

// Oblik razdvojen na osnovu i nastavak (crveno), ako oblik počinje osnovom.
// Boja svake osnove (ista u mementu i u popisu oblika).
const BASE_STYLE: Record<string, { box: string; text: string; vowel: string }> = {
  a: { box: 'bg-amber-100', text: 'text-amber-800', vowel: 'a' },
  i: { box: 'bg-sky-100', text: 'text-sky-800', vowel: 'i' },
  u: { box: 'bg-stone-200', text: 'text-stone-700', vowel: 'u' },
  e: { box: 'bg-emerald-100', text: 'text-emerald-800', vowel: 'e' },
  o: { box: 'bg-violet-100', text: 'text-violet-800', vowel: 'o' },
  te: { box: 'bg-rose-100', text: 'text-rose-800', vowel: 'te' },
}

// Memento: kako nastaju oblici glagola. Lijevo stupac kane (か き く け こ), u sredini osnova,
// desno nastavci koji se na nju dodaju i oblik koji nastaje (dodir ga izgovori).
function Memento({ word, furigana }: { word: ConjWord; furigana: boolean }) {
  const godan = ['godan', 'iku', 'aru'].includes(word.class)
  const dict = stemOf(word, BASES.find((b) => b.id === 'u')!)
  const root = godan ? word.word.slice(0, -1) : word.class === 'ichidan' ? word.word.slice(0, -1) : ''
  const verbForms = FORMS.filter((f) => f.kind === 'glagol')
  const note =
    word.class === 'ichidan'
      ? 'ichidan: る otpada, osnova je uvijek ista'
      : godan
        ? `godan: mijenja se zadnji slog ${word.reading.slice(-1)}`
        : `nepravilan glagol: osnove treba zapamtiti`
  return (
    <section className="mt-2 rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-sm">
        <span lang="ja" className="text-xl leading-[2] font-semibold">
          <Furi written={dict.written} reading={dict.reading} on={furigana} />
        </span>
        {root && (
          <span lang="ja" className="ml-2 text-stone-500">
            = {root} + <span className="font-semibold text-red-700">{word.word.slice(root.length)}</span>
          </span>
        )}
        <span className="ml-2 text-xs text-stone-500">({note})</span>
      </p>
      <table className="mt-1 w-full border-separate border-spacing-y-1 text-sm">
        <tbody>
          {BASES.map((b) => {
            const st = b.id === 'te' ? conjugate(word, 'te') : stemOf(word, b)
            const style = BASE_STYLE[b.id]
            const kana = godan && b.id !== 'te' ? st.reading.slice(-1) : ''
            const built = verbForms.filter((f) => baseFor(word, f.id) === b.id && f.id !== 'te')
            return (
              <tr key={b.id}>
                <td className={`w-8 rounded-l-lg text-center text-xs font-semibold ${style.box} ${style.text}`}>{style.vowel}</td>
                <td lang="ja" className={`w-10 text-center text-2xl font-semibold ${style.box} ${style.text}`}>
                  {kana || '·'}
                </td>
                <td lang="ja" className={`w-24 rounded-r-lg px-2 text-lg leading-[2] font-medium whitespace-nowrap ${style.box}`}>
                  <Furi written={st.written} reading={st.reading} on={furigana} />
                </td>
                <td className="pl-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {b.id === 'u' && <span className="text-xs text-stone-500">rječnički oblik</span>}
                    {built.length > 0 && <span className="text-stone-400">→</span>}
                    {built.map((f) => {
                      const r = conjugate(word, f.id)
                      // Isti oblik za dva značenja (来られる: mogućnost i pasiv): mali natpis koji je koji.
                      const twin = built.some((g) => g.id !== f.id && conjugate(word, g.id).written === r.written)
                      const ending = r.written.startsWith(st.written) ? r.written.slice(st.written.length) : ''
                      return (
                        <button
                          key={f.id}
                          onClick={() => void speak(r.reading)}
                          title={f.label}
                          className="rounded-lg bg-stone-50 px-1.5 py-0.5 ring-1 ring-stone-200 active:bg-stone-200"
                        >
                          <span lang="ja">
                            {ending && <span className="text-red-700">＋{ending} </span>}
                            <span className="text-stone-600">{r.written}</span>
                          </span>
                          {twin && <span className="ml-1 text-[10px] text-stone-400">{f.label}</span>}
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function Split({ word, formId, furigana }: { word: ConjWord; formId: string; furigana: boolean }) {
  const r = conjugate(word, formId)
  const base = BASES.find((b) => b.id === baseFor(word, formId))
  const stem = base && base.id !== 'te' ? stemOf(word, base) : null
  if (!base || !stem || !r.written.startsWith(stem.written) || r.written === stem.written)
    return <Furi written={r.written} reading={r.reading} on={furigana} />
  return (
    <>
      <span className={`rounded px-0.5 ${BASE_STYLE[base.id].box}`}>
        <Furi written={stem.written} reading={stem.reading} on={furigana} />
      </span>
      <span className="text-red-700">{r.written.slice(stem.written.length)}</span>
    </>
  )
}

// Primjeri iz priča (računaju se jednom).
const FORM_EXAMPLES = formExamples(stories, WORDS)
const CONSTRUCTIONS = constructionsByCategory(stories)
const storyTitle = (id: string) => stories.find((x) => x.id === id)?.title_ja ?? id

let playing: HTMLAudioElement | null = null
function playSentence(name: string) {
  const url = audioUrl(name)
  if (!url) return
  playing?.pause()
  playing = new Audio(url)
  playing.preservesPitch = true
  void playing.play().catch(() => {})
}

// Rečenica iz priče s istaknutom riječju ili blokom; 🔊 pušta rečenicu, prijevod je ispod sitno.
function ExampleLine({ ex, furigana }: { ex: Example; furigana: boolean }) {
  const s = ex.sentence
  const span = ex.chunk !== undefined ? chunkSpans(s)[ex.chunk] : null
  const hit = (wi: number) => (span ? wi >= span.from && wi < span.to : wi === ex.word)
  return (
    <li className="flex items-start gap-2 border-t border-stone-100 py-1.5">
      <button onClick={() => playSentence(s.audio)} aria-label="Poslušaj rečenicu" className="rounded-full px-1.5 text-stone-500 active:bg-stone-200">
        🔊
      </button>
      <div className="min-w-0">
        <p lang="ja" className="text-lg leading-[2]">
          {s.words.map((w, wi) => (
            <span key={wi} className={hit(wi) ? 'font-semibold text-red-700' : ''}>
              {w.furigana.map((p, pi) =>
                p.reading && furigana ? (
                  <ruby key={pi}>
                    {p.text}
                    <rt className="text-[0.55em] font-normal text-stone-500">{p.reading}</rt>
                  </ruby>
                ) : (
                  <span key={pi}>{p.text}</span>
                ),
              )}
            </span>
          ))}
        </p>
        <p className="text-xs text-stone-500">
          {s.hr} · <span lang="ja">{storyTitle(ex.storyId)}</span>
        </p>
      </div>
    </li>
  )
}

// Primjer pretvorbe za objašnjenje oblika (godan, ichidan, nepravilni; ili pridjev).
const SAMPLE: Record<Kind, string[]> = { glagol: ['飲む', '食べる', 'する', '来る'], 'i-pridjev': ['高い', 'いい'], 'na-pridjev': ['静か'] }

// Riječi za memento: iz tvojih priča, od najčešće.
const EXAMPLES = (() => {
  const count = new Map<string, number>()
  for (const list of FORM_EXAMPLES.values()) for (const e of list) count.set(e.lemma.word, (count.get(e.lemma.word) ?? 0) + 1)
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w).slice(0, 14)
  return top.length ? top : ['食べる']
})()
const KIND_TITLE: Record<Kind, string> = { glagol: 'glagol', 'i-pridjev': 'i-pridjev', 'na-pridjev': 'na-pridjev' }

function Te({ word, furigana }: { word: string; furigana: boolean }) {
  const w = byWord(word)
  const r = conjugate(w, 'te')
  return (
    <button onClick={() => void speak(r.reading)} className="rounded-lg bg-stone-100 px-2 py-1 active:bg-stone-200" lang="ja">
      <Furi written={w.word} reading={w.reading} on={furigana} /> →{' '}
      <span className="font-semibold text-red-700">
        <Furi written={r.written} reading={r.reading} on={furigana} />
      </span>
    </button>
  )
}

// Lekcija o te-obliku (pravila po zadnjoj kani, iznimke, čemu služi).
function TeLesson({ furigana }: { furigana: boolean }) {
  return (
    <div className="mx-auto mt-3 grid max-w-4xl gap-3 landscape:grid-cols-2">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Kako nastaje te-oblik</h2>
        <p className="mt-1 text-sm text-stone-600">
          Godan glagoli: odlučuje zadnja kana. Isto pravilo daje i prošli oblik (て → た, で → だ: 飲んで → 飲んだ).
        </p>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {TE_GODAN.map((r) => (
              <tr key={r.ends} className="border-t border-stone-100">
                <td className="py-1.5 pr-2 whitespace-nowrap" lang="ja">
                  ～{r.ends} → <span className="font-semibold text-red-700">{r.te}</span>
                </td>
                <td className="flex flex-wrap gap-1 py-1.5">
                  {r.words.map((w) => (
                    <Te key={w} word={w} furigana={furigana} />
                  ))}
                </td>
              </tr>
            ))}
            {TE_OTHER.map((r) => (
              <tr key={r.label} className="border-t border-stone-100">
                <td className="py-1.5 pr-2">
                  <span className="font-semibold">{r.label}</span>
                  <span className="block text-xs text-stone-500" lang="ja">
                    {r.note}
                  </span>
                </td>
                <td className="flex flex-wrap gap-1 py-1.5">
                  {r.words.map((w) => (
                    <Te key={w} word={w} furigana={furigana} />
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-stone-500">Pridjevi: 高い → 高くて, 静か → 静かで (i…, i…).</p>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Čemu služi</h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {TE_USES.map((u) => (
            <li key={u.ja} className="border-t border-stone-100 pt-2">
              <p>
                <span lang="ja" className="font-semibold">
                  {u.ja}
                </span>{' '}
                <span className="text-stone-500">· {u.hr}</span>
              </p>
              <p lang="ja" className="text-base leading-[2]">
                {u.ex.map(([t, r], i) =>
                  r && furigana ? (
                    <ruby key={i}>
                      {t}
                      <rt className="text-[0.6em] text-stone-500">{r}</rt>
                    </ruby>
                  ) : (
                    <span key={i}>{t}</span>
                  ),
                )}
              </p>
              <p className="text-xs text-stone-500">{u.exHr}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export default function Forms({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'oblici' | 'konstrukcije' | 'memento'>('oblici')
  const [chosen, setChosen] = useState(EXAMPLES[0])
  const [furigana, setFurigana] = useState(() => readSetting('oblici-furigana') !== '0')
  function toggleFurigana() {
    setFurigana(!furigana)
    writeSetting('oblici-furigana', furigana ? '0' : '1')
  }
  const word = byWord(chosen)
  const kind = kindOf(word)
  const forms = FORMS.filter((f) => f.kind === kind)

  return (
    <main className="min-h-dvh bg-stone-50 p-4 text-stone-900 landscape:px-6">
      <header className="flex items-center gap-2">
        <button onClick={onBack} className="rounded-full px-2 py-1 text-lg text-stone-500 active:bg-stone-200" aria-label="Natrag">
          ←
        </button>
        <h1 className="font-semibold">📐 Oblici</h1>
        <div className="ml-auto flex gap-1 text-sm">
          <button
            onClick={toggleFurigana}
            aria-pressed={furigana}
            aria-label={furigana ? 'Sakrij furiganu' : 'Prikaži furiganu'}
            className={`rounded-full px-3 py-1 font-semibold ${furigana ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'}`}
          >
            あ
          </button>
          {(
            [
              ['oblici', 'oblici'],
              ['konstrukcije', 'konstrukcije'],
              ['memento', 'memento'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              aria-pressed={tab === v}
              className={`rounded-full px-3 py-1 font-semibold ${tab === v ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>


      {tab === 'oblici' && (
        <div className="mx-auto mt-3 flex max-w-4xl flex-col gap-2">
          <p className="text-sm text-stone-500">Svi oblici iz konjugatora, od onih koji su najčešći u tvojim pričama. Dodirni za pravilo i primjere.</p>
          {[...FORMS]
            .sort((x, y) => (FORM_EXAMPLES.get(y.id)?.length ?? 0) - (FORM_EXAMPLES.get(x.id)?.length ?? 0))
            .map((f) => {
              const ex = FORM_EXAMPLES.get(f.id) ?? []
              return (
                <details key={f.id} className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                  <summary className="cursor-pointer">
                    <span className="font-semibold">{f.label}</span>{' '}
                    <span lang="ja" className="text-stone-600">
                      {f.ending}
                    </span>
                    <span className="ml-2 text-xs text-stone-400">
                      {f.kind} · {f.level} · {ex.length ? `${ex.length}× u pričama` : 'nema u pričama'}
                    </span>
                  </summary>
                  {f.id === 'te' ? (
                    <TeLesson furigana={furigana} />
                  ) : (
                    <ul className="mt-1 text-sm">
                      {SAMPLE[f.kind].map((w) => {
                        const sample = byWord(w)
                        const r = conjugate(sample, f.id)
                        return (
                          <li key={w} className="flex flex-wrap items-baseline gap-2 py-0.5">
                            <button onClick={() => void speak(r.reading)} lang="ja" className="rounded bg-stone-100 px-1.5 active:bg-stone-200">
                              <Furi written={sample.word} reading={sample.reading} on={furigana} /> →{' '}
                              <span className="text-red-700">
                                <Furi written={r.written} reading={r.reading} on={furigana} />
                              </span>
                            </button>
                            <span className="text-xs text-stone-500">{r.rule}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {ex.length > 0 && (
                    <>
                      <p className="mt-2 text-xs font-semibold text-stone-500">Iz tvojih priča</p>
                      <ul>
                        {ex.slice(0, 12).map((e, i) => (
                          <ExampleLine key={i} ex={e} furigana={furigana} />
                        ))}
                      </ul>
                    </>
                  )}
                </details>
              )
            })}
        </div>
      )}

      {tab === 'konstrukcije' && (
        <div className="mx-auto mt-3 flex max-w-4xl flex-col gap-3">
          <p className="text-sm text-stone-500">Konstrukcije iz tvojih priča (✦ u playeru), po onome što želiš reći. Nove priče same dodaju primjere.</p>
          {CATEGORIES.filter((c) => CONSTRUCTIONS.has(c.id)).map((c) => (
            <section key={c.id}>
              <h2 className="mb-1 font-semibold">{c.title}</h2>
              <div className="flex flex-col gap-1.5">
                {CONSTRUCTIONS.get(c.id)!.map((k) => (
                  <details key={k.key} className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                    <summary className="cursor-pointer">
                      <span lang="ja" className="font-semibold">
                        {k.key}
                      </span>
                      {k.key !== k.label && <span className="ml-2 text-sm text-stone-500">{k.label}</span>}
                      <span className="ml-2 text-xs text-stone-400">{k.examples.length}×</span>
                    </summary>
                    {k.formula && (
                      <p lang="ja" className="mt-1 text-sm">
                        {k.formula}
                      </p>
                    )}
                    {k.rule && <p className="text-xs text-stone-500">{k.rule}</p>}
                    <ul className="mt-1">
                      {k.examples.slice(0, 12).map((e, i) => (
                        <ExampleLine key={i} ex={e} furigana={furigana} />
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'memento' && (
        <div className="mx-auto mt-3 max-w-4xl">
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((w) => (
              <button
                key={w}
                lang="ja"
                onClick={() => setChosen(w)}
                aria-pressed={chosen === w}
                className={`rounded-full px-3 py-1 ${chosen === w ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'}`}
              >
                <Furi written={w} reading={byWord(w).reading} on={furigana} />
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-stone-500">
            <span lang="ja" className="font-semibold text-stone-800">
              <Furi written={word.word} reading={word.reading} on={furigana} />
            </span>{' '}
            · {word.hr} · {KIND_TITLE[kind]} · {forms.length} oblika
          </p>
          {kind === 'glagol' && <Memento word={word} furigana={furigana} />}
          <ul className="mt-2 grid gap-1.5 landscape:grid-cols-2">
            {forms.map((f) => {
              const r = conjugate(word, f.id)
              return (
                <li key={f.id}>
                  <button
                    onClick={() => void speak(r.reading)}
                    className="flex w-full items-baseline gap-3 rounded-xl bg-white px-3 py-2 text-left shadow-sm active:bg-stone-100"
                  >
                    <span className="w-28 shrink-0 text-sm text-stone-500">
                      {f.label}
                      <span className="block text-xs" lang="ja">
                        {f.ending} · {f.level}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span lang="ja" className="text-xl leading-[2] font-medium">
                        <Split word={word} formId={f.id} furigana={furigana} />
                      </span>
                      {kind === 'glagol' && baseFor(word, f.id) && f.id !== 'te' && (
                        <span className={`ml-2 rounded px-1 text-xs ${BASE_STYLE[baseFor(word, f.id)!].box} ${BASE_STYLE[baseFor(word, f.id)!].text}`}>
                          od {BASES.find((b) => b.id === baseFor(word, f.id))!.label}
                        </span>
                      )}
                      <span className="block text-xs text-stone-500">{r.rule}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-stone-400">Dodirni oblik da ga čuješ.</p>
        </div>
      )}
    </main>
  )
}
