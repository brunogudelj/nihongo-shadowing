// Provjerava je li priča unutar fonda riječi (JLPT N5 + N4). Pravila su u fond.mjs.
// Pokretanje: npm run provjera -- <tema>/<broj>   (npr. npm run provjera -- japanske-zeljeznice/001)
// Rezultat se upisuje u priču (polje "fond"). Besplatno je.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { checkFond, fondRecord, printFond } from './fond.mjs'

const storyArg = process.argv[2]
if (!storyArg) {
  console.error('Napiši priču, npr.: npm run provjera -- japanske-zeljeznice/001')
  process.exit(1)
}
const file = `content/stories/${storyArg}.json`
if (!existsSync(file)) {
  console.error(`Nema priče ${file}.`)
  process.exit(1)
}

const story = JSON.parse(readFileSync(file, 'utf8'))
const result = await checkFond(story, story.theme)
story.fond = fondRecord(result)
writeFileSync(file, JSON.stringify(story, null, 2) + '\n')
printFond(result)
