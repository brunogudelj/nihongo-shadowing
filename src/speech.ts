// Izgovor riječi, oblika i primjera: unaprijed izrađeni mp3 u public/izgovor/<ime>.mp3.
// Ime datoteke izvodi se iz teksta (isto u pipelineu i u aplikaciji), pa podaci ne moraju pamtiti imena.
// Datoteke se ne spremaju sve odjednom na mobitel, nego svaka kad se prvi put pusti (service worker).

// cyrb53: kratak, stabilan sažetak teksta (53 bita, praktično bez sudara za naš broj tekstova).
export function speechId(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

let current: HTMLAudioElement | null = null

// Pusti izgovor teksta (npr. čitanje riječi u kani). Vrati false ako zvuk ne postoji.
export async function speak(text: string, rate = 1): Promise<boolean> {
  current?.pause()
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}izgovor/${speechId(text)}.mp3`)
    if (!res.ok) return false
    // Cijeli mp3 u memoriju, da pouzdano svira i iz spremljene kopije (bez interneta).
    const url = URL.createObjectURL(await res.blob())
    const audio = new Audio(url)
    audio.preservesPitch = true
    audio.playbackRate = rate
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
    current = audio
    await audio.play()
    return true
  } catch {
    return false
  }
}
