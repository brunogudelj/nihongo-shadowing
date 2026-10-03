// Pomoć za vježbanje: zaslon se ne gasi, a kontrole rade sa zaključanog zaslona i iz slušalica.
import { useEffect, useRef } from 'react'

// Dok je zaslon priče otvoren, zaslon se ne gasi (Screen Wake Lock).
// Preglednik ga sam pusti kad se aplikacija skloni u pozadinu, pa ga ponovno tražimo kad se vrati.
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let released = false
    const request = async () => {
      if (released || document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        // Npr. štednja baterije: tada se zaslon gasi kao inače.
      }
    }
    const onVisible = () => void request()
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [])
}

type MediaControls = {
  title: string
  album: string
  playing: boolean
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
}

// Kontrole na zaključanom zaslonu, u obavijesti i na slušalicama (Media Session API).
export function useMediaSession({ title, album, playing, ...handlers }: MediaControls) {
  // Najnovije funkcije, da se akcije ne moraju ponovno prijavljivati pri svakom prikazu.
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    const actions: [MediaSessionAction, () => void][] = [
      ['play', () => handlersRef.current.onPlay()],
      ['pause', () => handlersRef.current.onPause()],
      ['stop', () => handlersRef.current.onPause()],
      ['nexttrack', () => handlersRef.current.onNext()],
      ['previoustrack', () => handlersRef.current.onPrevious()],
    ]
    for (const [action, handler] of actions) {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // Preglednik ne podržava tu akciju.
      }
    }
    return () => {
      for (const [action] of actions) {
        try {
          session.setActionHandler(action, null)
        } catch {
          // isto kao gore
        }
      }
    }
  }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'Nihongo Shadowing',
      album,
      artwork: [{ src: `${import.meta.env.BASE_URL}pwa-512.png`, sizes: '512x512', type: 'image/png' }],
    })
  }, [title, album])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])
}
