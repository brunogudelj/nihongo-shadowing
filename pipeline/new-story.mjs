// Nova priča od početka do kraja: priča (Claude, s provjerom fonda) → furigana → zvuk (Azure).
// Pokretanje: npm run nova-prica -- <tema>   (npr. npm run nova-prica -- kyushu)
// Ako neki korak padne, staje. Ono što je napravljeno ostaje spremljeno, pa se može
// nastaviti pojedinačno: npm run furigana -- <tema>/<broj>, npm run audio -- <tema>/<broj>.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const themeId = process.argv[2]
if (!themeId || !existsSync(`themes/${themeId}.yaml`)) {
  const themes = readdirSync('themes').map((f) => f.replace(/\.ya?ml$/, ''))
  console.error('Napiši temu, npr.: npm run nova-prica -- kyushu')
  console.error(`Teme: ${themes.join(', ')}`)
  process.exit(1)
}

// Broj nove priče (isto kao u story.mjs).
const dir = `content/stories/${themeId}`
const existing = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{3}\.json$/.test(f)).length : 0
const storyArg = `${themeId}/${String(existing + 1).padStart(3, '0')}`

function step(title, script, arg) {
  console.log(`\n=== ${title} ===`)
  const result = spawnSync(process.execPath, [`pipeline/${script}`, arg], { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`\n✗ Stalo na koraku "${title}".`)
    if (script !== 'story.mjs') console.error(`Nastavi kad popraviš: npm run ${script.replace('.mjs', '')} -- ${storyArg}`)
    process.exit(1)
  }
}

step('1/3 Priča (Claude)', 'story.mjs', themeId)
step('2/3 Furigana', 'furigana.mjs', storyArg)
step('3/3 Zvuk (Azure)', 'audio.mjs', storyArg)

const story = JSON.parse(readFileSync(`content/stories/${storyArg}.json`, 'utf8'))
console.log('\n=== Gotovo ===')
console.log(`${story.title_ja}  (${story.title_hr})`)
console.log(`Rečenica: ${story.sentences.length}, zvuk: ${(story.duration_ms / 1000).toFixed(1)} s`)
console.log(`Pokrivenost: ${story.fond.pokrivenost}%`)
if (story.trosak_usd !== undefined) console.log(`Trošak (Claude): ≈ ${story.trosak_usd.toFixed(3)} $`)
console.log(story.needs_review.length ? `Za ručnu provjeru:\n- ${story.needs_review.join('\n- ')}` : 'Ništa za ručnu provjeru.')
console.log(`Priča: content/stories/${storyArg}.json`)
