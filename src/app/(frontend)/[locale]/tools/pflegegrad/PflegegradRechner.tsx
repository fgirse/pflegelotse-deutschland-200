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
          <div key={modul.id} className="rounded-lg border bg-white p-4">
            <div className="font-semibold">{modul.titel}</div>
            <div className="text-sm text-slate-500">{modul.beschreibung}</div>
            <label className="mt-2 block text-sm text-slate-700">
              {t('frage')}
              <select
                value={auswahl[modul.id] ?? 0}
                onChange={(e) =>
                  setAuswahl((a) => ({ ...a, [modul.id]: Number(e.target.value) as Schweregrad }))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
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
        className="rounded-lg border-2 border-blue-700 bg-blue-50 p-4"
        aria-live="polite"
      >
        <div className="text-sm text-slate-600">{t('ergebnis')}</div>
        <div className="text-2xl font-bold text-blue-900">{ergebnis.label}</div>
        <div className="text-sm text-slate-600">
          {t('punkte')}: {ergebnis.punkte} / 100
        </div>
        <p className="mt-2 text-xs text-slate-500">{t('disclaimer')}</p>
      </section>

      {/* Nachfrage-Funnel (/F730/) */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/markt"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          {t('ctaMarkt')}
        </Link>
        <Link
          href="/lotse"
          className="rounded-md border border-blue-700 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
        >
          {t('ctaLotse')}
        </Link>
      </div>
    </div>
  )
}
