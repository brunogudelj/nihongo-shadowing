// Konjugacija glagola i pridjeva (N5 + N4) prema pravilima, bez interneta.
// Svaki oblik se računa i za pismo (食べる) i za čitanje (たべる), uz kratko pravilo na hrvatskom.

export type ConjWord = {
  word: string
  reading: string
  class: string // godan, ichidan, iku, aru, kuru, suru, suru-imenica, i-pridjev, ii, na-pridjev
  level: string
  hr: string
  transitive?: boolean
}

export type Kind = 'glagol' | 'i-pridjev' | 'na-pridjev'

export type Form = { id: string; label: string; ending: string; level: 'N5' | 'N4'; kind: Kind }

export type Result = { written: string; reading: string; rule: string }

export const FORMS: Form[] = [
  { id: 'masu', label: 'uljudni oblik', ending: '～ます', level: 'N5', kind: 'glagol' },
  { id: 'masen', label: 'uljudni niječni', ending: '～ません', level: 'N5', kind: 'glagol' },
  { id: 'mashita', label: 'uljudni prošli', ending: '～ました', level: 'N5', kind: 'glagol' },
  { id: 'masendeshita', label: 'uljudni niječni prošli', ending: '～ませんでした', level: 'N5', kind: 'glagol' },
  { id: 'te', label: 'te-oblik', ending: '～て', level: 'N5', kind: 'glagol' },
  { id: 'ta', label: 'obični prošli', ending: '～た', level: 'N5', kind: 'glagol' },
  { id: 'nai', label: 'obični niječni', ending: '～ない', level: 'N5', kind: 'glagol' },
  { id: 'nakatta', label: 'obični niječni prošli', ending: '～なかった', level: 'N5', kind: 'glagol' },
  { id: 'tai', label: 'želja (želim)', ending: '～たい', level: 'N4', kind: 'glagol' },
  { id: 'potential', label: 'mogućnost (mogu)', ending: '～える / ～られる', level: 'N4', kind: 'glagol' },
  { id: 'volitional', label: 'namjera (hajdemo)', ending: '～おう / ～よう', level: 'N4', kind: 'glagol' },
  { id: 'ba', label: 'uvjet (ako)', ending: '～ば', level: 'N4', kind: 'glagol' },
  { id: 'passive', label: 'pasiv', ending: '～れる / ～られる', level: 'N4', kind: 'glagol' },
  { id: 'causative', label: 'kauzativ (natjerati, dopustiti)', ending: '～せる / ～させる', level: 'N4', kind: 'glagol' },

  { id: 'i-desu', label: 'uljudni oblik', ending: '～いです', level: 'N5', kind: 'i-pridjev' },
  { id: 'i-nai', label: 'niječni', ending: '～くない', level: 'N5', kind: 'i-pridjev' },
  { id: 'i-ta', label: 'prošli', ending: '～かった', level: 'N5', kind: 'i-pridjev' },
  { id: 'i-nakatta', label: 'niječni prošli', ending: '～くなかった', level: 'N5', kind: 'i-pridjev' },
  { id: 'i-te', label: 'te-oblik (i…)', ending: '～くて', level: 'N5', kind: 'i-pridjev' },
  { id: 'i-adv', label: 'prilog', ending: '～く', level: 'N5', kind: 'i-pridjev' },
  { id: 'i-ba', label: 'uvjet (ako)', ending: '～ければ', level: 'N4', kind: 'i-pridjev' },

  { id: 'na-desu', label: 'uljudni oblik', ending: '～です', level: 'N5', kind: 'na-pridjev' },
  { id: 'na-nai', label: 'niječni', ending: '～じゃない', level: 'N5', kind: 'na-pridjev' },
  { id: 'na-ta', label: 'prošli', ending: '～だった', level: 'N5', kind: 'na-pridjev' },
  { id: 'na-nakatta', label: 'niječni prošli', ending: '～じゃなかった', level: 'N5', kind: 'na-pridjev' },
  { id: 'na-te', label: 'te-oblik (i…)', ending: '～で', level: 'N5', kind: 'na-pridjev' },
  { id: 'na-adv', label: 'prilog', ending: '～に', level: 'N5', kind: 'na-pridjev' },
  { id: 'na-noun', label: 'ispred imenice', ending: '～な + imenica', level: 'N5', kind: 'na-pridjev' },
]

export function kindOf(w: ConjWord): Kind {
  if (w.class === 'i-pridjev' || w.class === 'ii') return 'i-pridjev'
  if (w.class === 'na-pridjev') return 'na-pridjev'
  return 'glagol'
}

// Godan: zadnja kana u stupcu u → stupci a, i, e, o.
const ROWS: Record<string, { a: string; i: string; e: string; o: string }> = {
  う: { a: 'わ', i: 'い', e: 'え', o: 'お' },
  く: { a: 'か', i: 'き', e: 'け', o: 'こ' },
  ぐ: { a: 'が', i: 'ぎ', e: 'げ', o: 'ご' },
  す: { a: 'さ', i: 'し', e: 'せ', o: 'そ' },
  つ: { a: 'た', i: 'ち', e: 'て', o: 'と' },
  ぬ: { a: 'な', i: 'に', e: 'ね', o: 'の' },
  ぶ: { a: 'ば', i: 'び', e: 'べ', o: 'ぼ' },
  む: { a: 'ま', i: 'み', e: 'め', o: 'も' },
  る: { a: 'ら', i: 'り', e: 'れ', o: 'ろ' },
}

// Godan te/ta: う, つ, る → って; む, ぶ, ぬ → んで; く → いて; ぐ → いで; す → して.
function godanTe(last: string, past: boolean): string {
  const te = { う: 'って', つ: 'って', る: 'って', む: 'んで', ぶ: 'んで', ぬ: 'んで', く: 'いて', ぐ: 'いで', す: 'して' }[last] ?? ''
  return past ? te.replace('て', 'た').replace('で', 'だ') : te
}

const TE_RULE: Record<string, string> = {
  う: '-う, -つ, -る → って',
  つ: '-う, -つ, -る → って',
  る: '-う, -つ, -る → って',
  む: '-む, -ぶ, -ぬ → んで',
  ぶ: '-む, -ぶ, -ぬ → んで',
  ぬ: '-む, -ぶ, -ぬ → んで',
  く: '-く → いて',
  ぐ: '-ぐ → いで',
  す: '-す → して',
}

// Primijeni isti nastavak na pismo i čitanje (oba završavaju istom kanom).
function both(w: ConjWord, cut: number, add: string): Pick<Result, 'written' | 'reading'> {
  return { written: w.word.slice(0, w.word.length - cut) + add, reading: w.reading.slice(0, w.reading.length - cut) + add }
}

// 来る: pismo ostaje 来, mijenja se samo čitanje (き / こ / く).
function kuru(w: ConjWord, readingStem: string, add: string): Pick<Result, 'written' | 'reading'> {
  const prefix = w.word.slice(0, -2)
  const rprefix = w.reading.slice(0, -2)
  return { written: prefix + '来' + add, reading: rprefix + readingStem + add }
}

// する (i ～する glagoli): する se mijenja cijeli.
function suru(w: ConjWord, form: string): Pick<Result, 'written' | 'reading'> {
  return { written: w.word.slice(0, -2) + form, reading: w.reading.slice(0, -2) + form }
}

function conjugateVerb(w: ConjWord, form: string): Result {
  const cls = w.class
  const last = w.reading.slice(-1)
  const godan = cls === 'godan' || cls === 'iku' || cls === 'aru'
  const isSuru = cls === 'suru' || cls === 'suru-imenica'
  const row = ROWS[last]

  // Osnova za ～ます (stupac i): godan u → i; ichidan bez る; 来る → き; する → し.
  const masuStem = (add: string, rule: string): Result => {
    if (godan) return { ...both(w, 1, row.i + add), rule: `Godan glagol: zadnje -${last} → -${row.i}, pa ${add}. ${rule}` }
    if (cls === 'kuru') return { ...kuru(w, 'き', add), rule: `来る je nepravilan: 来(き) + ${add}. ${rule}` }
    if (isSuru) return { ...suru(w, 'し' + add), rule: `する je nepravilan: する → し + ${add}. ${rule}` }
    return { ...both(w, 1, add), rule: `Ichidan glagol: makni る, pa ${add}. ${rule}` }
  }
  // Osnova za ～ない (stupac a): godan u → a (う → わ); ichidan bez る; 来る → こ; する → し.
  const naiStem = (add: string, rule: string): Result => {
    if (cls === 'aru') return { ...both(w, 2, add), rule: `ある je iznimka: niječno je samo ${add}. ${rule}` }
    if (godan) return { ...both(w, 1, row.a + add), rule: `Godan glagol: zadnje -${last} → -${row.a}, pa ${add}. ${rule}` }
    if (cls === 'kuru') return { ...kuru(w, 'こ', add), rule: `来る je nepravilan: 来(こ) + ${add}. ${rule}` }
    if (isSuru) return { ...suru(w, 'し' + add), rule: `する je nepravilan: する → し + ${add}. ${rule}` }
    return { ...both(w, 1, add), rule: `Ichidan glagol: makni る, pa ${add}. ${rule}` }
  }
  const teTa = (past: boolean): Result => {
    const name = past ? 'Obični prošli oblik' : 'Te-oblik'
    const t = past ? 'た' : 'て'
    if (cls === 'iku') return { ...both(w, 1, past ? 'った' : 'って'), rule: `行く je iznimka: く → っ${t} (ne い${t}).` }
    if (godan) {
      const rule = TE_RULE[last]
      return { ...both(w, 1, godanTe(last, past)), rule: `${name} godan glagola: ${past ? rule.replace(/て/g, 'た').replace(/で/g, 'だ') : rule}.` }
    }
    if (cls === 'kuru') return { ...kuru(w, 'き', t), rule: `来る je nepravilan: 来(き) + ${t}.` }
    if (isSuru) return { ...suru(w, 'し' + t), rule: `する je nepravilan: する → し${t}.` }
    return { ...both(w, 1, t), rule: `Ichidan glagol: makni る, pa ${t}.` }
  }

  switch (form) {
    case 'masu':
      return masuStem('ます', 'Uljudni sadašnji/budući oblik.')
    case 'masen':
      return masuStem('ません', 'Uljudni niječni oblik.')
    case 'mashita':
      return masuStem('ました', 'Uljudni prošli oblik.')
    case 'masendeshita':
      return masuStem('ませんでした', 'Uljudni niječni prošli: ～ません + でした.')
    case 'tai':
      return masuStem('たい', 'Želja: "želim …". Dalje se mijenja kao i-pridjev.')
    case 'te':
      return teTa(false)
    case 'ta':
      return teTa(true)
    case 'nai':
      return naiStem('ない', 'Obični niječni oblik.')
    case 'nakatta':
      return naiStem('なかった', 'Obični niječni prošli: ない → なかった.')
    case 'potential':
      if (godan) return { ...both(w, 1, row.e + 'る'), rule: `Godan: zadnje -${last} → -${row.e}る. Znači "moći …".` }
      if (cls === 'kuru') return { ...kuru(w, 'こ', 'られる'), rule: '来る je nepravilan: 来(こ)られる. Znači "moći doći".' }
      if (isSuru) return { ...suru(w, 'できる'), rule: 'する → できる. Znači "moći (učiniti)".' }
      return { ...both(w, 1, 'られる'), rule: 'Ichidan: makni る, pa られる. Znači "moći …".' }
    case 'volitional':
      if (godan) return { ...both(w, 1, row.o + 'う'), rule: `Godan: zadnje -${last} → -${row.o}う. Znači "hajdemo …" ili "namjeravam …".` }
      if (cls === 'kuru') return { ...kuru(w, 'こ', 'よう'), rule: '来る je nepravilan: 来(こ)よう.' }
      if (isSuru) return { ...suru(w, 'しよう'), rule: 'する → しよう.' }
      return { ...both(w, 1, 'よう'), rule: 'Ichidan: makni る, pa よう. Znači "hajdemo …" ili "namjeravam …".' }
    case 'ba':
      if (godan) return { ...both(w, 1, row.e + 'ば'), rule: `Godan: zadnje -${last} → -${row.e}ば. Znači "ako …".` }
      if (cls === 'kuru') return { ...kuru(w, 'く', 'れば'), rule: '来る je nepravilan: 来(く)れば.' }
      if (isSuru) return { ...suru(w, 'すれば'), rule: 'する → すれば.' }
      return { ...both(w, 1, 'れば'), rule: 'Ichidan: makni る, pa れば. Znači "ako …".' }
    case 'passive':
      if (godan) return { ...both(w, 1, row.a + 'れる'), rule: `Godan: zadnje -${last} → -${row.a}れる. Pasiv: "biti …-n" ili da se nekome nešto dogodi.` }
      if (cls === 'kuru') return { ...kuru(w, 'こ', 'られる'), rule: '来る je nepravilan: 来(こ)られる.' }
      if (isSuru) return { ...suru(w, 'される'), rule: 'する → される.' }
      return { ...both(w, 1, 'られる'), rule: 'Ichidan: makni る, pa られる (isto kao mogućnost).' }
    case 'causative':
      if (godan) return { ...both(w, 1, row.a + 'せる'), rule: `Godan: zadnje -${last} → -${row.a}せる. Znači "natjerati / dopustiti nekome da …".` }
      if (cls === 'kuru') return { ...kuru(w, 'こ', 'させる'), rule: '来る je nepravilan: 来(こ)させる.' }
      if (isSuru) return { ...suru(w, 'させる'), rule: 'する → させる.' }
      return { ...both(w, 1, 'させる'), rule: 'Ichidan: makni る, pa させる. Znači "natjerati / dopustiti nekome da …".' }
  }
  throw new Error(`Nepoznat oblik ${form}`)
}

function conjugateI(w: ConjWord, form: string): Result {
  // いい se mijenja preko よい: よくない, よかった…
  const ii = w.class === 'ii'
  const stem = (add: string): Pick<Result, 'written' | 'reading'> =>
    ii ? { written: 'よ' + add, reading: 'よ' + add } : both(w, 1, add)
  const note = ii ? ' いい je iznimka: mijenja se preko よい (よ + …).' : ''
  switch (form) {
    case 'i-desu':
      return { written: w.word + 'です', reading: w.reading + 'です', rule: 'i-pridjev + です, bez promjene.' }
    case 'i-nai':
      return { ...stem('くない'), rule: `i-pridjev: zadnji い → くない.${note}` }
    case 'i-ta':
      return { ...stem('かった'), rule: `i-pridjev: zadnji い → かった.${note}` }
    case 'i-nakatta':
      return { ...stem('くなかった'), rule: `i-pridjev: zadnji い → くなかった.${note}` }
    case 'i-te':
      return { ...stem('くて'), rule: `i-pridjev: zadnji い → くて; veže s idućim pridjevom ili rečenicom.${note}` }
    case 'i-adv':
      return { ...stem('く'), rule: `i-pridjev: zadnji い → く; prilog ("brzo", "dobro").${note}` }
    case 'i-ba':
      return { ...stem('ければ'), rule: `i-pridjev: zadnji い → ければ; "ako je …".${note}` }
  }
  throw new Error(`Nepoznat oblik ${form}`)
}

function conjugateNa(w: ConjWord, form: string): Result {
  const add = (s: string, rule: string): Result => ({ written: w.word + s, reading: w.reading + s, rule })
  switch (form) {
    case 'na-desu':
      return add('です', 'na-pridjev + です.')
    case 'na-nai':
      return add('じゃない', 'na-pridjev + じゃない (pisano: ではない).')
    case 'na-ta':
      return add('だった', 'na-pridjev + だった.')
    case 'na-nakatta':
      return add('じゃなかった', 'na-pridjev + じゃなかった.')
    case 'na-te':
      return add('で', 'na-pridjev + で; veže s idućim pridjevom ili rečenicom.')
    case 'na-adv':
      return add('に', 'na-pridjev + に; prilog ("ljubazno", "tiho").')
    case 'na-noun':
      return add('な', 'na-pridjev + な ispred imenice (きれいな花 = lijep cvijet).')
  }
  throw new Error(`Nepoznat oblik ${form}`)
}

export function conjugate(w: ConjWord, form: string): Result {
  const kind = kindOf(w)
  if (kind === 'i-pridjev') return conjugateI(w, form)
  if (kind === 'na-pridjev') return conjugateNa(w, form)
  return conjugateVerb(w, form)
}
