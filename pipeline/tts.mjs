// Izrađuje mp3 za rečenice preko Azure Neural TTS.
// Pokretanje: npm run tts
// Ključ i regija čitaju se iz okoline (GitHub Codespaces Secrets ili .env).
// Audio koji već postoji se NE izrađuje ponovno (štedi besplatni limit).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const VOICE = 'ja-JP-NanamiNeural'
// Mono, 48 kbps: malen za mobitel i offline rad.
const FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const SENTENCES = ['content/prototip.json']
const AUDIO_DIR = 'content/audio'

const key = process.env.AZURE_SPEECH_KEY
const region = process.env.AZURE_SPEECH_REGION
if (!key || !region) {
  console.error('Nedostaje AZURE_SPEECH_KEY ili AZURE_SPEECH_REGION.')
  console.error('Spremi ih u GitHub Codespaces Secrets i ponovno pokreni Codespace.')
  process.exit(1)
}

mkdirSync(AUDIO_DIR, { recursive: true })

for (const file of SENTENCES) {
  const sentence = JSON.parse(readFileSync(file, 'utf8'))
  const out = `${AUDIO_DIR}/${sentence.id}.mp3`
  if (existsSync(out)) {
    console.log(`Preskačem ${out} (već postoji).`)
    continue
  }

  const text = sentence.segments.map((s) => s.text).join('')
  const ssml = `<speak version="1.0" xml:lang="ja-JP"><voice name="${VOICE}">${text}</voice></speak>`

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': FORMAT,
      'User-Agent': 'nihongo-shadowing',
    },
    body: ssml,
  })
  if (!res.ok) {
    console.error(`Azure greška ${res.status}: ${await res.text()}`)
    process.exit(1)
  }

  writeFileSync(out, Buffer.from(await res.arrayBuffer()))
  console.log(`Izrađen ${out} (${text.length} znakova).`)
}
