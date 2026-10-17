// Velika blijeda slika riječi u pozadini kartice (npr. 🌊 iza 海). Ako riječ nema sliku, ništa.
import { emojiFor } from './emoji'

export default function EmojiBackdrop({ word, reading }: { word: string; reading: string }) {
  const e = emojiFor(word, reading)
  if (!e) return null
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-[7rem] opacity-25 select-none">
      {e}
    </span>
  )
}
