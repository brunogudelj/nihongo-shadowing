// Oblici: lekcija o te-obliku i svi oblici iz konjugatora za izabranu riječ, na jednom zaslonu.
// Oblici se računaju pravilima (conjugate.ts), kao u konjugatoru; 🔊 pušta izgovor ako postoji.
import { useState } from 'react'
import allWords from '../data/konjugator.json'
import { conjugate, FORMS, kindOf, type ConjWord, type Kind } from './conjugate'
import { speak } from './speech'

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
const TE_USES = [
  { ja: '～てください', hr: 'molim te, napravi…', ex: '待ってください。', exHr: 'Pričekajte, molim.' },
  { ja: '～ています', hr: 'radnja u tijeku ili stanje', ex: '雨が降っています。', exHr: 'Pada kiša.' },
  { ja: '～てもいいです', hr: 'smije se…', ex: '写真を撮ってもいいですか。', exHr: 'Smijem li fotografirati?' },
  { ja: '～てから', hr: 'nakon što…', ex: 'ご飯を食べてから、出かけます。', exHr: 'Nakon jela izlazim.' },
  { ja: '～て、～', hr: 'veže radnje redom (i zatim)', ex: '駅へ行って、電車に乗りました。', exHr: 'Otišao sam na stanicu i ušao u vlak.' },
]

const EXAMPLES = ['食べる', '行く', '飲む', '書く', '話す', 'する', '来る', '勉強する', '高い', 'いい', '静か']
const KIND_TITLE: Record<Kind, string> = { glagol: 'glagol', 'i-pridjev': 'i-pridjev', 'na-pridjev': 'na-pridjev' }

function Te({ word }: { word: string }) {
  const w = byWord(word)
  const r = conjugate(w, 'te')
  return (
    <button onClick={() => void speak(r.reading)} className="rounded-lg bg-stone-100 px-2 py-1 active:bg-stone-200" lang="ja">
      {w.word} → <span className="font-semibold text-red-700">{r.written}</span>
    </button>
  )
}

export default function Forms({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'te' | 'svi'>('te')
  const [chosen, setChosen] = useState('食べる')
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
          {(
            [
              ['te', 'te-oblik'],
              ['svi', 'svi oblici'],
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

      {tab === 'te' && (
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
                        <Te key={w} word={w} />
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
                        <Te key={w} word={w} />
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
                  <p lang="ja" className="text-base">
                    {u.ex}
                  </p>
                  <p className="text-xs text-stone-500">{u.exHr}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'svi' && (
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
                {w}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-stone-500">
            <span lang="ja" className="font-semibold text-stone-800">
              {word.word}
            </span>{' '}
            ({word.reading}) · {word.hr} · {KIND_TITLE[kind]} · {forms.length} oblika
          </p>
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
                      <span lang="ja" className="text-xl font-medium">
                        {r.written}
                      </span>
                      {r.reading !== r.written && (
                        <span lang="ja" className="ml-2 text-sm text-stone-500">
                          {r.reading}
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
