// Romaji → hiragana, da se čitanje može upisati običnom tipkovnicom (kaisatsu → かいさつ).
// Prihvaća Hepburn i česte varijante (shi/si, chi/ti, tsu/tu, fu/hu, ji/zi), dvostruki suglasnik (kitte → きって),
// n' ili nn (kin'en), te crticu za dugi samoglasnik (ō → おう, ū → うう). Kana i kanji prolaze bez promjene.

const TABLE: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ', za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と', da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ', ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', wa: 'わ', wo: 'を',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ', gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  sha: 'しゃ', shu: 'しゅ', she: 'しぇ', sho: 'しょ', sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  ja: 'じゃ', ju: 'じゅ', je: 'じぇ', jo: 'じょ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ', zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
  cha: 'ちゃ', chu: 'ちゅ', che: 'ちぇ', cho: 'ちょ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ', hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ', pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ', rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', '-': 'ー',
}

const LONG: Record<string, string> = { ā: 'aa', ī: 'ii', ū: 'uu', ē: 'ei', ō: 'ou', â: 'aa', î: 'ii', û: 'uu', ê: 'ei', ô: 'ou' }

export function toHiragana(input: string): string {
  const s = input.toLowerCase().replace(/[āīūēōâîûêô]/g, (c) => LONG[c])
  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]
    // n prije suglasnika, kraja, apostrofa ili nn → ん
    if (c === 'n') {
      const next = s[i + 1]
      if (next === "'") {
        out += 'ん'
        i += 2
        continue
      }
      // nn: ispred samoglasnika je ん + na/ni… (konnichiwa → こんにちわ), inače samo ん
      if (next === 'n') {
        out += 'ん'
        i += /[aiueoy]/.test(s[i + 2] ?? '') ? 1 : 2
        continue
      }
      if (next === undefined || !/[aiueoy]/.test(next)) {
        out += 'ん'
        i += 1
        continue
      }
    }
    // dvostruki suglasnik → っ (kitte, matcha)
    if (/[bcdfghjkmprstvwz]/.test(c) && (s[i + 1] === c || (c === 't' && s.slice(i + 1, i + 3) === 'ch'))) {
      out += 'っ'
      i += 1
      continue
    }
    const hit = [3, 2, 1].map((n) => s.slice(i, i + n)).find((part) => TABLE[part])
    if (hit) {
      out += TABLE[hit]
      i += hit.length
    } else {
      out += c // kana, kanji, razmak… ostaju
      i += 1
    }
  }
  return out
}

// Je li tekst (barem djelomično) upisan latinicom, pa ga treba pretvoriti.
export const isLatin = (s: string) => /[a-zāīūēō]/i.test(s)
