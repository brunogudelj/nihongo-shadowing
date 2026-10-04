// Izgovor riječi, oblika i primjera → public/izgovor/<ime>.mp3 (Azure TTS, glas Nanami).
// Pokretanje: npm run izgovor        (za probu: npm run izgovor -- 6, samo prvih 6)
// Besplatni Azure dopušta samo 20 zahtjeva u minuti, pa se u jednom zahtjevu izgovori grupa
// tekstova s tišinom između njih. ffmpeg pronađe te tišine u snimci i reže točno u njima
// (bez ponovnog kodiranja), pa svaki tekst ostaje cijel i prirodno izgovoren.
// Ako se broj tišina ne slaže s brojem tekstova, ti se tekstovi izgovore jedan po jedan.
// Izgovor koji već postoji se preskače.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import ffmpeg from 'ffmpeg-static'
import sdk from 'microsoft-cognitiveservices-speech-sdk'
import { speechId } from '../src/speech.ts'

const VOICE = 'ja-JP-NanamiNeural'
const DIR = 'public/izgovor'
const TMP = 'node_modules/.tmp-izgovor.mp3'
const GROUP = 25 // tekstova po zahtjevu
const PAUSE_MS = 900 // tišina između tekstova
const MIN_GAP_MS = 3300 // razmak između zahtjeva: najviše ~18 u minuti
const LEAD_S = 0.12 // tišina koja ostaje prije i poslije teksta

const key = process.env.AZURE_SPEECH_KEY
const region = process.env.AZURE_SPEECH_REGION
if (!key || !region) {
  console.error('Nedostaje AZURE_SPEECH_KEY ili AZURE_SPEECH_REGION.')
  process.exit(1)
}

// Što treba izgovoriti. Riječi se izgovaraju iz čitanja (kana), da Azure ne pogriješi čitanje kanjija.
const texts = new Set()
for (const w of JSON.parse(readFileSync('data/rijeci.json', 'utf8'))) texts.add(w.reading)

mkdirSync(DIR, { recursive: true })
const limit = Number(process.argv[2]) || Infinity
const todo = [...texts].filter((t) => t && !existsSync(`${DIR}/${speechId(t)}.mp3`)).slice(0, limit)
console.log(
  `Tekstova: ${texts.size}, treba izgovoriti: ${todo.length} (${Math.ceil(todo.length / GROUP)} zahtjeva, ~${Math.ceil(todo.length / GROUP / 15)} min)`,
)

const config = sdk.SpeechConfig.fromSubscription(key, region)
config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let last = 0
let chars = 0

// Jedan zahtjev Azureu (uz poštivanje ograničenja i ponovni pokušaj); vrati mp3.
async function synthesize(group) {
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ja-JP"><voice name="${VOICE}">` +
    group.map((t) => `${escape(t)}。<break time="${PAUSE_MS}ms"/>`).join('') +
    `</voice></speak>`
  for (let attempt = 1; ; attempt++) {
    await sleep(Math.max(0, last + MIN_GAP_MS - Date.now()))
    last = Date.now()
    try {
      const audio = await new Promise((resolve, reject) => {
        const synthesizer = new sdk.SpeechSynthesizer(config, null)
        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            synthesizer.close()
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) resolve(Buffer.from(result.audioData))
            else reject(new Error(result.errorDetails))
          },
          (err) => {
            synthesizer.close()
            reject(new Error(err))
          },
        )
      })
      chars += group.reduce((n, t) => n + t.length + 1, 0)
      return audio
    } catch (err) {
      if (attempt >= 4) throw err
      console.log(`  Azure: ${String(err.message).slice(0, 80)}… čekam i pokušavam ponovno (${attempt}/3)`)
      await sleep(15000 * attempt)
    }
  }
}

// Tišine u snimci: [{ start, end }] u sekundama (ffmpeg silencedetect).
// Tišina koja traje do kraja snimke nema silence_end, pa joj je kraj kraj snimke.
function findSilences(file) {
  const log = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-50dB:d=0.5', '-f', 'null', '-'], {
    encoding: 'utf8',
  }).stderr
  const [, h, m, s] = /Duration: (\d+):(\d+):([\d.]+)/.exec(log) ?? [0, 0, 0, 0]
  const duration = Number(h) * 3600 + Number(m) * 60 + Number(s)
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((x) => Number(x[1]))
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((x) => Number(x[1]))
  return starts.map((start, i) => ({ start, end: ends[i] ?? duration }))
}

function cut(file, from, to, out) {
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', from.toFixed(3), '-to', to.toFixed(3), '-i', file, '-c', 'copy', out])
}

const outFile = (t) => `${DIR}/${speechId(t)}.mp3`

for (let g = 0; g < todo.length; g += GROUP) {
  const group = todo.slice(g, g + GROUP)
  writeFileSync(TMP, await synthesize(group))

  // Tišine iza govora (ne ona na samom početku snimke). Očekujemo točno jednu iza svakog teksta.
  const gaps = findSilences(TMP).filter((s) => s.start > 0.05)
  if (gaps.length === group.length) {
    let from = 0
    group.forEach((t, i) => {
      cut(TMP, Math.max(0, from - LEAD_S), gaps[i].start + LEAD_S, outFile(t))
      from = gaps[i].end
    })
  } else {
    // Ne slaže se: svaki tekst posebno (sporije, ali sigurno).
    console.log(`  Grupa ${g / GROUP + 1}: ${gaps.length} tišina za ${group.length} tekstova, izgovaram jedan po jedan.`)
    for (const t of group) {
      writeFileSync(TMP, await synthesize([t]))
      const gap = findSilences(TMP).find((s) => s.start > 0.05)
      cut(TMP, 0, gap ? gap.start + LEAD_S : 30, outFile(t))
    }
  }
  console.log(`  ${Math.min(g + GROUP, todo.length)} / ${todo.length}`)
}
rmSync(TMP, { force: true })
console.log(`Gotovo. Potrošeno ${chars} znakova (besplatno do 500.000 mjesečno).`)
