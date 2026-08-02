'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PFLEGE_QUALIFIKATIONEN, type PflegekraftStammDaten } from '@/shared/pflegekraftStamm'
import type { MitarbeiterZeile } from '@/shared/mitarbeiter'

const WOCHENTAGE = [1, 2, 3, 4, 5, 6, 7]

// Minuten seit Mitternacht ↔ "HH:MM" (für <input type="time">).
function minToTime(min?: number): string {
  if (typeof min !== 'number') return ''
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
function timeToMin(v: string): number | undefined {
  if (!v) return undefined
  const [h, m] = v.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return undefined
  return h * 60 + m
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

// Editor für das operative Stammprofil einer Pflegekraft. Wird als Panel unter
// der Liste eingeblendet und mit den bestehenden Werten vorbelegt.
export function StammEditor({
  mitarbeiter,
  initial,
  onSaved,
  onClose,
}: {
  mitarbeiter: MitarbeiterZeile
  initial?: PflegekraftStammDaten
  onSaved: (pflegekraftId: string, daten: PflegekraftStammDaten) => void
  onClose: () => void
}) {
  const t = useTranslations('team')
  const [quali, setQuali] = useState<string[]>(initial?.qualifikation ?? [])
  const [geschlecht, setGeschlecht] = useState<string>(initial?.geschlecht ?? '')
  const [von, setVon] = useState(minToTime(initial?.standardStartzeit))
  const [bis, setBis] = useState(minToTime(initial?.standardEndzeit))
  const [maxE, setMaxE] = useState(initial?.maxEinsaetze != null ? String(initial.maxEinsaetze) : '')
  const [tage, setTage] = useState<number[]>(initial?.wochentage ?? [])
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  async function speichern() {
    if (busy) return
    setBusy(true)
    setFehler(null)
    const daten: PflegekraftStammDaten = {
      qualifikation: quali as PflegekraftStammDaten['qualifikation'],
      geschlecht: (geschlecht || undefined) as PflegekraftStammDaten['geschlecht'],
      standardStartzeit: timeToMin(von),
      standardEndzeit: timeToMin(bis),
      maxEinsaetze: maxE ? Number(maxE) : undefined,
      wochentage: [...tage].sort((a, b) => a - b),
    }
    try {
      const res = await fetch(`/api/v1/team/mitarbeiter/${mitarbeiter.id}/stammdaten`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(daten),
      })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      onSaved(mitarbeiter.pflegekraftId as string, daten)
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card border-2 border-[var(--color-accent)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">
          {t('stammTitel', { email: mitarbeiter.email })}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-[var(--color-muted)] hover:underline"
        >
          {t('schliessen')}
        </button>
      </div>
      {fehler && <p className="mt-3 text-sm text-danger">⚠ {fehler}</p>}
      <div className="mt-4 flex flex-col gap-4">
        {/* Qualifikation */}
        <div className="label">
          {t('stammQualifikation')}
          <div className="mt-1 flex flex-wrap gap-4">
            {PFLEGE_QUALIFIKATIONEN.map((q) => (
              <label key={q} className="flex items-center gap-2 text-sm font-normal">
                <input
                  type="checkbox"
                  checked={quali.includes(q)}
                  onChange={() => setQuali((a) => toggle(a, q))}
                />
                {t(`quali_${q}`)}
              </label>
            ))}
          </div>
        </div>

        {/* Geschlecht */}
        <label className="label">
          {t('stammGeschlecht')}
          <select
            className="input"
            value={geschlecht}
            onChange={(e) => setGeschlecht(e.target.value)}
          >
            <option value="">{t('stammGeschlechtLeer')}</option>
            <option value="m">{t('geschlechtM')}</option>
            <option value="w">{t('geschlechtW')}</option>
            <option value="d">{t('geschlechtD')}</option>
          </select>
        </label>

        {/* Standard-Arbeitszeit */}
        <div className="flex flex-wrap gap-3">
          <label className="label flex-1">
            {t('stammVon')}
            <input type="time" className="input" value={von} onChange={(e) => setVon(e.target.value)} />
          </label>
          <label className="label flex-1">
            {t('stammBis')}
            <input type="time" className="input" value={bis} onChange={(e) => setBis(e.target.value)} />
          </label>
          <label className="label w-28">
            {t('stammMaxEinsaetze')}
            <input
              type="number"
              min={0}
              className="input"
              value={maxE}
              onChange={(e) => setMaxE(e.target.value)}
            />
          </label>
        </div>

        {/* Regelarbeitstage */}
        <div className="label">
          {t('stammWochentage')}
          <div className="mt-1 flex flex-wrap gap-2">
            {WOCHENTAGE.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTage((a) => toggle(a, d))}
                aria-pressed={tage.includes(d)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  tage.includes(d)
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'border-[var(--color-line)] text-[var(--color-muted)] hover:bg-[var(--color-line)]'
                }`}
              >
                {t(`wt_${d}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={speichern} disabled={busy} className="btn btn-primary">
            {t('stammSpeichern')}
          </button>
          <button onClick={onClose} type="button" className="btn btn-outline">
            {t('abbrechen')}
          </button>
        </div>
      </div>
    </section>
  )
}
