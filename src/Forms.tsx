// Oblici: lekcija o te-obliku i svi oblici iz konjugatora za izabranu riječ, na jednom zaslonu.
// Oblici se računaju pravilima (conjugate.ts), kao u konjugatoru; 🔊 pušta izgovor ako postoji.
import { useState } from 'react'
import allWords from '../data/konjugator.json'
import { conjugate, FORMS, kindOf, type ConjWord, type Kind } from './conjugate'
import { readSetting, writeSetting } from './settings'
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

const EXAMPLES = ['食べる', '行く', '飲む', '書く', '話す', 'する', '来る', '勉強する', '高い', 'いい', '静か']
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

export default function Forms({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'te' | 'svi'>('te')
  const [chosen, setChosen] = useState('食べる')
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
                        <Furi written={r.written} reading={r.reading} on={furigana} />
                      </span>
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
