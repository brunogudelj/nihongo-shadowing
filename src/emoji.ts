// Slika (emoji) uz riječ: data/emoji.json, ključ "riječ|čitanje". Apstraktne riječi nemaju sliku.
import emoji from '../data/emoji.json'

const EMOJI = emoji as Record<string, string>

export const emojiFor = (word: string, reading: string): string | undefined => EMOJI[`${word}|${reading}`]
