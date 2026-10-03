// Izrađuje mp3 za priču (po rečenici, po bloku i za cijelu priču) preko Azure TTS-a,
// i sprema vrijeme početka i kraja svake riječi (za isticanje i postupno slaganje).
// Pokretanje: npm run audio -- <tema>/<broj>   (npr. npm run audio -- japanske-zeljeznice/001)
// Ključ i regija čitaju se iz okoline (GitHub Codespaces Secrets ili .env).
// Zvuk koji već postoji (mp3 + vremena u priči) se NE izrađuje ponovno.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sdk from 'microsoft-cognitiveservices-speech-sdk'

const VOICE = 'ja-JP-NanamiNeural'
const AUDIO_DIR = 'content/audio'
const TICKS_PER_MS = 10000 // Azure mjeri vrijeme u jedinicama od 100 ns

const storyArg = process.argv[2]
if (!storyArg) {
  console.error('Napiši priču, npr.: npm run audio -- japanske-zeljeznice/001')
  process.exit(1)
}
const file = `content/stories/${storyArg}.json`
if (!existsSync(file)) {
  console.error(`Nema priče ${file}.`)
  process.exit(1)
}
const key = process.env.AZURE_SPEECH_KEY
const region = process.env.AZURE_SPEECH_REGION
if (!key || !region) {
  console.error('Nedostaje AZURE_SPEECH_KEY ili AZURE_SPEECH_REGION.')
  process.exit(1)
}

const config = sdk.SpeechConfig.fromSubscription(key, region)
config.speechSynthesisVoiceName = VOICE
config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3

// Izgovori tekst; vrati mp3 i granice riječi (pozicija u tekstu + vrijeme u ms).
function synthesize(text) {
  const synthesizer = new sdk.SpeechSynthesizer(config, null)
  const boundaries = []
  synthesizer.wordBoundary = (_, e) => {
    boundaries.push({
      offset: e.textOffset,
      length: e.wordLength,
      start: e.audioOffset / TICKS_PER_MS,
      end: (e.audioOffset + e.duration) / TICKS_PER_MS,
    })
  }
  return new Promise((resolve, reject) => {
    synthesizer.speakTextAsync(
      text,
      (result) => {
        synthesizer.close()
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          resolve({ audio: Buffer.from(result.audioData), boundaries, duration: result.audioDuration / TICKS_PER_MS })
        } else {
          reject(new Error(result.errorDetails))
        }
      },
      (err) => {
        synthesizer.close()
        reject(new Error(err))
      },
    )
  })
}

// Vremena za dijelove teksta [start, end): od granica koje ih dodiruju.
// Dio bez granice (npr. interpunkcija) dobije vrijeme između susjeda.
function timesFor(spans, boundaries, totalMs) {
  const times = spans.map(([a, b]) => {
    const hit = boundaries.filter((x) => x.offset < b && x.offset + x.length > a)
    return hit.length ? { start: Math.min(...hit.map((x) => x.start)), end: Math.max(...hit.map((x) => x.end)) } : null
  })
  times.forEach((t, i) => {
    if (t) return
    const prev = times.slice(0, i).reverse().find(Boolean)
    const next = times.slice(i + 1).find(Boolean)
    const start = prev ? prev.end : 0
    times[i] = { start, end: next ? next.start : Math.max(start, totalMs) }
  })
  return times.map((t) => ({ start_ms: Math.round(t.start), end_ms: Math.round(t.end) }))
}

const story = JSON.parse(readFileSync(file, 'utf8'))
const base = story.id
mkdirSync(AUDIO_DIR, { recursive: true })
let chars = 0

// 1) Rečenice, jedna po jedna.
for (const [i, s] of story.sentences.entries()) {
  const name = `${base}-${i + 1}.mp3`
  if (existsSync(`${AUDIO_DIR}/${name}`) && s.audio === name && s.words.every((w) => 'start_ms' in w)) {
    console.log(`Preskačem ${name} (već postoji).`)
    continue
  }
  const { audio, boundaries, duration } = await synthesize(s.ja)
  writeFileSync(`${AUDIO_DIR}/${name}`, audio)
  chars += s.ja.length

  let pos = 0
  const spans = s.words.map((w) => [pos, (pos += w.text.length)])
  timesFor(spans, boundaries, duration).forEach((t, wi) => Object.assign(s.words[wi], t))
  s.audio = name
  s.duration_ms = Math.round(duration)
  console.log(`Izrađen ${name} (${(duration / 1000).toFixed(1)} s, ${boundaries.length} granica riječi)`)
}

// 2) Svaki blok (chunk) izgovoren zasebno: prirodan početak i kraj, bez rezanja snimke rečenice.
for (const [i, s] of story.sentences.entries()) {
  const names = s.chunks.map((_, k) => `${base}-${i + 1}-${k + 1}.mp3`)
  if (s.chunk_audio?.join('|') === names.join('|') && names.every((n) => existsSync(`${AUDIO_DIR}/${n}`))) {
    console.log(`Preskačem blokove rečenice ${i + 1} (već postoje).`)
    continue
  }
  for (const [k, chunk] of s.chunks.entries()) {
    if (existsSync(`${AUDIO_DIR}/${names[k]}`)) continue
    const { audio } = await synthesize(chunk)
    writeFileSync(`${AUDIO_DIR}/${names[k]}`, audio)
    chars += chunk.length
  }
  s.chunk_audio = names
  console.log(`Izrađeni blokovi rečenice ${i + 1} (${names.length})`)
}

// 3) Cijela priča u jednom mp3, s vremenom početka i kraja svake rečenice.
const fullName = `${base}-cijela.mp3`
if (existsSync(`${AUDIO_DIR}/${fullName}`) && story.audio === fullName && story.sentences.every((s) => 'full_start_ms' in s)) {
  console.log(`Preskačem ${fullName} (već postoji).`)
} else {
  const fullText = story.sentences.map((s) => s.ja).join('')
  const { audio, boundaries, duration } = await synthesize(fullText)
  writeFileSync(`${AUDIO_DIR}/${fullName}`, audio)
  chars += fullText.length

  let pos = 0
  const spans = story.sentences.map((s) => [pos, (pos += s.ja.length)])
  timesFor(spans, boundaries, duration).forEach((t, si) => {
    story.sentences[si].full_start_ms = t.start_ms
    story.sentences[si].full_end_ms = t.end_ms
  })
  story.audio = fullName
  story.duration_ms = Math.round(duration)
  console.log(`Izrađen ${fullName} (${(duration / 1000).toFixed(1)} s)`)
}

writeFileSync(file, JSON.stringify(story, null, 2) + '\n')

// Ispis vremena za prvu rečenicu, kao primjer.
const first = story.sentences[0]
console.log(`\nPrimjer, rečenica 1 (${first.ja}):`)
for (const w of first.words) console.log(`  ${w.text.padEnd(8, '　')} ${w.start_ms}–${w.end_ms} ms`)
console.log(`\nSpremljeno: ${file}`)
console.log(`Potrošeno ${chars} znakova (besplatno do 500.000 mjesečno).`)
