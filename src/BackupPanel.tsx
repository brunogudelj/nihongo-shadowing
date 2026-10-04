// Gumbi za izvoz i uvoz sigurnosne kopije napretka.
import { useRef, useState } from 'react'
import { exportBackup, importBackup } from './backup'

const NAMES: Record<string, string> = { myWords: 'riječi' }
const describe = (counts: Record<string, number>) =>
  Object.entries(counts)
    .map(([k, n]) => `${n} ${NAMES[k] ?? k}`)
    .join(', ')

export default function BackupPanel() {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <p className="font-semibold">Sigurnosna kopija</p>
      <p className="mt-1 text-sm text-stone-500">
        Sve je spremljeno samo na ovom mobitelu. Izvezi kopiju (npr. jednom tjedno) i spremi je negdje sigurno (Google
        Drive, mail sebi). Uvoz dodaje riječi iz kopije, a postojeće ne briše.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={async () => {
            try {
              const { file, counts } = await exportBackup()
              setMessage({ ok: true, text: `Izvezeno (${describe(counts)}) u datoteku ${file}, u mapi Preuzimanja.` })
            } catch {
              setMessage({ ok: false, text: 'Izvoz nije uspio.' })
            }
          }}
          className="flex-1 rounded-xl bg-stone-800 py-3 font-semibold text-white active:bg-stone-900"
        >
          ⬇ Izvezi
        </button>
        <button
          onClick={() => input.current?.click()}
          className="flex-1 rounded-xl bg-stone-200 py-3 font-semibold text-stone-800 active:bg-stone-300"
        >
          ⬆ Uvezi
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              const counts = await importBackup(file)
              setMessage({ ok: true, text: `Uvezeno: ${describe(counts) || 'ništa'}.` })
            } catch (err) {
              setMessage({ ok: false, text: err instanceof Error ? err.message : 'Uvoz nije uspio.' })
            }
          }}
        />
      </div>
      {message && (
        <p className={`mt-2 text-sm ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</p>
      )}
    </section>
  )
}
