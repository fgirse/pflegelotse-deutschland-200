'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  PFLEGEGRAD_MODULE,
  berechnePflegegrad,
  type Schweregrad,
} from '@/lib/pflegegrad'

// Rein clientseitig: keine Daten verlassen den Browser (/F720/). Die Berechnung
// ist eine unverbindliche Orientierung (Disclaimer unten).
export function PflegegradRechner() {
  const t = useTranslations('pflegegrad')
  const [auswahl, setAuswahl] = useState<Record<string, Schweregrad>>({})

  const stufen = [t('stufe0'), t('stufe1'), t('stufe2'), t('stufe3'), t('stufe4')]
  const ergebnis = useMemo(() => berechnePflegegrad(auswahl), [auswahl])

  return (
    <div className="mt-6 flex flex-col gap-5">
      <fieldset className="flex flex-col gap-4">
        {PFLEGEGRAD_MODULE.map((modul) => (
          <div key={modul.id} className="card p-4">
            <div className="font-semibold">{modul.titel}</div>
            <div className="text-sm text-[var(--color-faint)]">{modul.beschreibung}</div>
            <label className="label mt-2">
              {t('frage')}
              <select
                value={auswahl[modul.id] ?? 0}
                onChange={(e) =>
                  setAuswahl((a) => ({ ...a, [modul.id]: Number(e.target.value) as Schweregrad }))
                }
                className="input"
              >
                {stufen.map((label, i) => (
                  <option key={i} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </fieldset>

      {/* Ergebnis */}
      <section
        className="card border-2 border-[var(--color-accent-strong)] bg-[var(--color-accent-soft)] p-5"
        aria-live="polite"
      >
        <div className="text-sm text-[var(--color-muted)]">{t('ergebnis')}</div>
        <div className="text-2xl font-bold text-[var(--color-accent)]">{ergebnis.label}</div>
        <div className="text-sm text-[var(--color-muted)]">
          {t('punkte')}: {ergebnis.punkte} / 100
        </div>
        <p className="mt-2 text-xs text-[var(--color-faint)]">{t('disclaimer')}</p>
      </section>

      {/* Nachfrage-Funnel (/F730/) */}
      <div className="flex flex-wrap gap-3">
        <Link href="/markt" className="btn btn-accent">
          {t('ctaMarkt')}
        </Link>
        <Link href="/lotse" className="btn btn-outline">
          {t('ctaLotse')}
        </Link>
      </div>
    </div>
  )
}
