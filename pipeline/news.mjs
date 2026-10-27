// Priprema dnevne vijesti: skine naslove s hrvatskih RSS izvora (HRT, Index), zapiše ih u
// themes/vijesti.yaml (Claude bira jednu vijest i prepričava je u 5 rečenica) i obriše vijesti
// starije od 30 dana (priča + zvuk). Zatim ide obična nova priča: npm run nova-prica -- vijesti
// Pokretanje: node pipeline/news.mjs   (samo brisanje starih i dupliciranih: node pipeline/news.mjs --samo-ciscenje)

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { stringify } from 'yaml'

// HRT-ova adresa nije poznata sigurno; probaju se redom, prva koja radi se koristi.
const FEEDS = [
  { name: 'HRT', url: 'https://vijesti.hrt.hr/rss' },
  { name: 'HRT', url: 'https://www.hrt.hr/rss' },
  { name: 'HRT', url: 'https://vijesti.hrt.hr/rss/vijesti' },
  { name: 'HRT', url: 'https://www.hrt.hr/rss/vijesti' },
  { name: 'HRT', url: 'https://vijesti.hrt.hr/feed' },
  { name: 'HRT', url: 'https://www.hrt.hr/feed' },
  { name: 'Index', url: 'https://www.index.hr/rss' },
]
const KEEP_DAYS = 30
const MAX_HEADLINES = 20
const DIR = 'content/stories/vijesti'

// Tekst iz RSS-a: makni CDATA, HTML oznake i najčešće znakovne entitete.
function clean(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseRss(xml) {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map(([item]) => {
    const tag = (t) => clean(item.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? '')
    return { naslov: tag('title'), sazetak: tag('description').slice(0, 300) }
  })
}

// Već obrađene teme se izbacuju prije Claudea (inače isti naslov, koji danima stoji na popisu, dolazi
// opet). Usporedba po korijenima riječi (prvih 4 slova), da Hrgović i Hrgovića budu isto.
const stems = (t) => new Set((t.toLowerCase().match(/[\p{L}\d]{4,}/gu) ?? []).map((w) => w.slice(0, 4)))
export function sameTopic(a, b) {
  const x = stems(a)
  const y = stems(b)
  const shared = [...x].filter((w) => y.has(w)).length
  return shared >= 2 && shared >= 0.3 * Math.min(x.size, y.size)
}

// Spremljene vijesti: brišu se starije od 30 dana i one koje ponavljaju već obrađenu temu
// (zajedno sa zvukom i s fat verzijom koja je na njima građena). Ostale daju popis obrađenih tema.
const today = new Date().toISOString().slice(0, 10)
const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10)
const saved = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => /^\d{3}\.json$/.test(f)).sort().map((f) => ({ f, story: JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) }))
  : []
// Arhiva vijesti starijih od 30 dana: rečenice ostaju kao primjeri za 📐 Oblici (samo polja koja
// trebaju primjerima), uz zvuk rečenice u public/arhiva/.
const ARCHIVE = 'content/vijesti-arhiva.json'
const archive = existsSync(ARCHIVE) ? JSON.parse(readFileSync(ARCHIVE, 'utf8')) : []
const slim = (story) => ({
  id: story.id,
  theme: story.theme,
  level: story.level,
  created: story.created,
  title_ja: story.title_ja,
  title_hr: story.title_hr,
  sentences: story.sentences.map((x) => ({
    ja: x.ja,
    hr: x.hr,
    chunks: x.chunks,
    chunk_info: x.chunk_info?.map((c) => ({ grammar_hr: c.grammar_hr, formula: c.formula, rule_hr: c.rule_hr })),
    words: x.words.map((w) => ({ text: w.text, lemma: w.lemma, furigana: w.furigana })),
    audio_arhiva: `arhiva/${x.audio}`,
  })),
})
// Zvuk rečenica arhiviranih vijesti ide u public/arhiva/ (mobitel ga sprema tek kad se pusti);
// zvuk blokova i cijele vijesti se briše.
const ARCHIVE_AUDIO = 'public/arhiva'
function remove(story, why, keep = false) {
  if (keep) {
    mkdirSync(ARCHIVE_AUDIO, { recursive: true })
    for (const x of story.sentences) if (existsSync(`content/audio/${x.audio}`)) renameSync(`content/audio/${x.audio}`, `${ARCHIVE_AUDIO}/${x.audio}`)
    if (!archive.some((a) => a.id === story.id)) archive.push(slim(story))
  }
  rmSync(`${DIR}/${story.id.slice(-3)}.json`)
  for (const a of readdirSync('content/audio').filter((a) => a.startsWith(`${story.id}-`))) rmSync(`content/audio/${a}`)
  console.log(`Obrisana vijest ${story.id} (${why})${keep ? ', tekst ostaje u arhivi' : ''}: ${story.title_hr}`)
}
const recent = []
const removed = new Set()
const archived = new Set()
for (const { story } of saved) {
  if (story.base) continue // fat građena na light vijesti: ide zajedno sa svojom light
  if ((story.created ?? today) < cutoff) {
    remove(story, `starija od ${KEEP_DAYS} dana`, true)
    removed.add(story.id)
    archived.add(story.id)
  } else if (recent.some((r) => sameTopic(story.title_hr, r))) {
    remove(story, 'ponavlja već obrađenu temu')
    removed.add(story.id)
  } else {
    recent.push(story.title_hr)
  }
}
for (const { story } of saved) if (story.base && removed.has(story.base)) remove(story, `uz ${story.base}`, archived.has(story.base))
// Starije vijesti bez para (prije light/fat) i same po sebi stare također u arhivu (gore, keep = true).
if (archived.size) writeFileSync(ARCHIVE, JSON.stringify(archive) + '\n')
if (process.argv.includes('--samo-ciscenje')) process.exit(0)

const headlines = []
for (const feed of FEEDS) {
  if (headlines.some((h) => h.izvor === feed.name)) continue // isti izvor s druge adrese ne treba
  try {
    const res = await fetch(feed.url, { headers: { 'user-agent': 'nihongo-shadowing (GitHub Actions)' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const items = parseRss(await res.text()).filter((x) => x.naslov)
    console.log(`${feed.name} (${feed.url}): ${items.length} naslova`)
    headlines.push(...items.slice(0, MAX_HEADLINES / 2).map((x) => ({ izvor: feed.name, ...x })))
  } catch (e) {
    console.log(`${feed.name} (${feed.url}): nije uspjelo (${e.message})`)
  }
}
if (!headlines.length) {
  console.error('Nijedan izvor vijesti nije dostupan. Ništa nije napravljeno (ništa nije potrošeno).')
  process.exit(1)
}

const fresh = headlines.filter((h) => !recent.some((r) => sameTopic(h.naslov, r)))
console.log(`Izbačeno već obrađenih: ${headlines.length - fresh.length}, ostaje ${fresh.length} naslova.`)
if (!fresh.length) {
  console.error('Svi naslovi su već obrađeni. Danas nema nove vijesti (ništa nije potrošeno).')
  process.exit(1)
}

const theme = {
  naziv: 'Vijest dana',
  razina: 'fat',
  opis:
    'Kratka vijest iz Hrvatske za učenje japanskog. Izaberi JEDNU vijest s popisa naslova koja je ' +
    'zanimljiva i razumljiva (vrijeme, sport, kultura, turizam, znanost, gospodarstvo, svakodnevni život). ' +
    'Preskoči zločine, nesreće sa žrtvama, rat i političke sukobe.',
  upute: [
    'A short news report about the chosen headline, in polite form, third person, giving context: who, where, why, what happens next. The number and length of sentences follow the story rules for the level.',
    'Retell it in your own words. Do not translate or copy the article text.',
    'Use only facts from the headline and summary. Do not invent numbers, names or quotes.',
    'Croatian place and person names in katakana (ザグレブ, スプリト).',
    'Avoid katakana loanwords that are not N5/N4 words (e.g. use 試合 and 選手, not チーム or ビデオ).',
    'title_hr: the Croatian headline you chose (shortened if long). title_ja: its short Japanese title.',
  ],
  vec_obradjeno: recent.length ? [...new Set(recent)] : undefined,
  naslovi: fresh,
}
writeFileSync(
  'themes/vijesti.yaml',
  '# Tema za dnevnu vijest. Ovu datoteku svaki dan iznova piše pipeline/news.mjs; ne mijenjaj je ručno.\n\n' +
    stringify(theme, { lineWidth: 0 }),
)
console.log(`Spremljeno themes/vijesti.yaml (${fresh.length} naslova).`)
