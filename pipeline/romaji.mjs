// Kana → romaji (Hepburn, s crticom za dugi samoglasnik: トーキョー → tōkyō).
// Ulaz je izgovor (katakana ili hiragana), npr. iz Kuromojija: は kao čestica je već ワ.

const toKatakana = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))

const DIGRAPHS = {
  キャ: 'kya', キュ: 'kyu', キョ: 'kyo', ギャ: 'gya', ギュ: 'gyu', ギョ: 'gyo',
  シャ: 'sha', シュ: 'shu', シェ: 'she', ショ: 'sho', ジャ: 'ja', ジュ: 'ju', ジェ: 'je', ジョ: 'jo',
  チャ: 'cha', チュ: 'chu', チェ: 'che', チョ: 'cho', ニャ: 'nya', ニュ: 'nyu', ニョ: 'nyo',
  ヒャ: 'hya', ヒュ: 'hyu', ヒョ: 'hyo', ビャ: 'bya', ビュ: 'byu', ビョ: 'byo', ピャ: 'pya', ピュ: 'pyu', ピョ: 'pyo',
  ミャ: 'mya', ミュ: 'myu', ミョ: 'myo', リャ: 'rya', リュ: 'ryu', リョ: 'ryo',
  ティ: 'ti', ディ: 'di', トゥ: 'tu', ドゥ: 'du', ファ: 'fa', フィ: 'fi', フェ: 'fe', フォ: 'fo',
  ウィ: 'wi', ウェ: 'we', ウォ: 'wo', ヴァ: 'va', ヴィ: 'vi', ヴェ: 've', ヴォ: 'vo', ツァ: 'tsa',
}

const SINGLE = {
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o', カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go', サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo', タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do', ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho', バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po', マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo', ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro', ワ: 'wa', ヲ: 'o',
  ヴ: 'vu', ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o', ャ: 'ya', ュ: 'yu', ョ: 'yo',
  '、': ',', '。': '.', '！': '!', '？': '?',
}

const MACRON = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' }

export function toRomaji(kana) {
  const s = toKatakana(kana)
  let out = ''
  let double = false // ッ: udvostruči idući suglasnik
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === 'ッ') {
      double = true
      continue
    }
    if (c === 'ー') {
      const last = out.slice(-1)
      if (MACRON[last]) out = out.slice(0, -1) + MACRON[last]
      continue
    }
    if (c === 'ン') {
      // n' ispred samoglasnika ili y, da se ne pročita krivo (kin'en ≠ kinen)
      const next = DIGRAPHS[s.slice(i + 1, i + 3)] ?? SINGLE[s[i + 1]] ?? ''
      out += /^[aiueoy]/.test(next) ? "n'" : 'n'
      continue
    }
    let syl = DIGRAPHS[s.slice(i, i + 2)]
    if (syl) i++
    else syl = SINGLE[c] ?? c
    if (double) {
      out += syl.startsWith('ch') ? 't' : syl[0]
      double = false
    }
    out += syl
  }
  return out
}
