'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

// Heutiges Datum als YYYY-MM-DD (lokale Zeit) — Vorbelegung des Datumsfelds.
function heuteISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Erzeugt aus den Stammtouren den Wochenrahmenplan (§5.2.2). Das Datum ist ein
// beliebiger Tag der Zielwoche; der Server normalisiert auf den Montag.
export function WochenplanButton() {
  const t = useTranslations('wochenplan')
  const router = useRouter()
  const [datum, setDatum] = useState(heuteISO())
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  async function planen() {
    setBusy(true)
    setInfo(null)
    try {
      const res = await fetch('/api/v1/stammtouren/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ datum }),
      })
      if (!res.ok) {
        setInfo(t('fehler'))
        return
      }
      const d = await res.json()
      setInfo(t('ergebnis', { erzeugt: d.erzeugt, uebersprungen: d.uebersprungen }))
      router.refresh()
    } catch {
      setInfo(t('fehler'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-6 card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="font-display text-lg font-semibold">{t('titel')}</div>
          <div className="text-sm text-[var(--color-muted)]">{t('hinweis')}</div>
        </div>
        <label className="label ml-auto">
          {t('woche')}
          <input className="input" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </label>
        <button onClick={planen} disabled={busy} className="btn btn-primary">
          {busy ? t('plant') : t('planen')}
        </button>
      </div>
      {info && <p className="mt-2 text-sm text-[var(--color-muted)]">{info}</p>}
    </section>
  )
}
