// Izvoz i uvoz sigurnosne kopije napretka. Uvoz: prvo pokaže što je u datoteci, pa Spoji ili Zamijeni (uz potvrdu).
import { useRef, useState } from 'react'
import { applyBackup, backupFileName, BackupError, exportBackup, parseBackup, summarize, type Backup } from './backup'

const NAMES: Record<string, string> = {
  myWords: 'riječi',
  sentences: 'statusa rečenica',
  places: 'mjesta u pričama',
  conjAttempts: 'odgovora u konjugatoru',
  vodic: 'stanje vodiča',
  days: 'dana vodiča',
  wordReviews: 'ponavljanja riječi',
  postavke: 'postavki',
}
const describe = (counts: Record<string, number>) =>
  Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${NAMES[k] ?? k}`)
    .join(', ') || 'ništa novo'

export default function BackupPanel() {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  // Učitana datoteka koja čeka odluku (Spoji / Zamijeni), i je li tražena potvrda za Zamijeni.
  const [pending, setPending] = useState<Backup | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  async function apply(mode: 'spoji' | 'zamijeni') {
    if (!pending) return
    try {
      const counts = await applyBackup(pending, mode)
      setMessage({ ok: true, text: `${mode === 'spoji' ? 'Spojeno' : 'Zamijenjeno'}: ${describe(counts)}.` })
    } catch {
      setMessage({ ok: false, text: 'Uvoz nije uspio. Ništa nije promijenjeno.' })
    }
    setPending(null)
    setConfirmReplace(false)
  }

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <p className="font-semibold">Sigurnosna kopija</p>
      <p className="mt-1 text-sm text-stone-500">
        Tvoj napredak (moje riječi, statusi rečenica, gdje si stao, postavke) spremljen je samo na ovom mobitelu. Izvezi
        kopiju (npr. jednom tjedno) i spremi je negdje sigurno (Google Drive, mail sebi). Uvezi je ako se podaci izgube ili
        prelaziš na novi mobitel.
      </p>

      {!pending && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={async () => {
              try {
                const b = await exportBackup()
                setMessage({ ok: true, text: `Izvezeno (${describe(summarize(b))}) u ${backupFileName(b)}, u mapi Preuzimanja.` })
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
                setPending(parseBackup(await file.text()))
                setMessage(null)
              } catch (err) {
                setMessage({ ok: false, text: err instanceof BackupError ? err.message : 'Datoteku nije moguće pročitati.' })
              }
            }}
          />
        </div>
      )}

      {pending && (
        <div className="mt-3 rounded-xl bg-stone-100 p-3 text-sm">
          <p>
            U datoteci{pending.exportedAt ? ` od ${pending.exportedAt.slice(0, 10)}` : ''}: {describe(summarize(pending))}.
          </p>
          {!confirmReplace ? (
            <div className="mt-3 flex flex-col gap-2">
              <button onClick={() => apply('spoji')} className="rounded-xl bg-stone-800 py-3 font-semibold text-white">
                Spoji
                <span className="block text-xs font-normal text-stone-300">dodaj što nedostaje, postojeće ne diraj</span>
              </button>
              <button onClick={() => setConfirmReplace(true)} className="rounded-xl bg-stone-200 py-3 font-semibold">
                Zamijeni
                <span className="block text-xs font-normal text-stone-500">trenutne podatke zamijeni datotekom</span>
              </button>
              <button onClick={() => setPending(null)} className="py-2 text-stone-500">
                Odustani
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <p className="font-semibold text-red-800">
                Ovo briše sve trenutne podatke na ovom mobitelu i stavlja one iz datoteke. Sigurno?
              </p>
              <button onClick={() => apply('zamijeni')} className="rounded-xl bg-red-700 py-3 font-semibold text-white">
                Da, zamijeni
              </button>
              <button onClick={() => setConfirmReplace(false)} className="py-2 text-stone-500">
                Ne, natrag
              </button>
            </div>
          )}
        </div>
      )}

      {message && <p className={`mt-2 text-sm ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</p>}
    </section>
  )
}
