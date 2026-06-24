'use client'

import { useTranslations } from 'next-intl'
import type { Tour } from '@/shared/domain'
import { minToHHMM } from '@/shared/time'

// Einfacher Zeitstrahl einer Tour: Einsätze auf einer Achse von 07:00–14:00.
// Konflikt (Ankunft nach spätestem Beginn) wird rot UND mit Symbol markiert —
// nie Farbe allein (/Q400/).
const START = 7 * 60
const ENDE = 14 * 60
const SPANNE = ENDE - START

export function Timeline({ tour }: { tour: Tour }) {
  const t = useTranslations('dashboard')
  const pct = (min: number) => ((min - START) / SPANNE) * 100

  return (
    <div className="mb-3">
      <div className="mb-1 text-xs text-slate-600">
        {tour.pflegekraftId} · {tour.einsaetze.length} {t('stops')}
      </div>
      <div className="relative h-9 rounded bg-slate-100" aria-hidden="true">
        {tour.einsaetze.map((e) => {
          const ankunft = e.ankunft ?? e.zeitfenster.von
          const konflikt = ankunft > e.zeitfenster.bis
          return (
            <div
              key={e.pseudonymId}
              title={`${minToHHMM(ankunft)} (${minToHHMM(e.zeitfenster.von)}–${minToHHMM(e.zeitfenster.bis)})`}
              className={`absolute top-1 flex h-7 items-center justify-center rounded px-1 text-[10px] font-medium text-white ${
                konflikt ? 'bg-red-600' : 'bg-blue-600'
              }`}
              style={{
                left: `${Math.max(0, Math.min(98, pct(ankunft)))}%`,
                minWidth: '34px',
              }}
            >
              {konflikt ? '⚠ ' : ''}
              {minToHHMM(ankunft)}
            </div>
          )
        })}
      </div>
      {/* Textuelle Entsprechung für Screenreader. */}
      <ul className="sr-only">
        {tour.einsaetze.map((e, i) => (
          <li key={e.pseudonymId}>
            {i + 1}. {minToHHMM(e.ankunft ?? e.zeitfenster.von)},{' '}
            {e.ankunft && e.ankunft > e.zeitfenster.bis ? 'Zeitfensterkonflikt' : 'im Zeitfenster'}
          </li>
        ))}
      </ul>
    </div>
  )
}
