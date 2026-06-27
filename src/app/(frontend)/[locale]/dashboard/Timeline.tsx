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
      <div className="mb-1 text-xs text-[var(--color-muted)]">
        {tour.pflegekraftId} · {tour.einsaetze.length} {t('stops')}
      </div>
      <div className="relative h-9 rounded bg-[var(--color-paper)]" aria-hidden="true">
        {tour.einsaetze.map((e) => {
          const ankunft = e.ankunft ?? e.zeitfenster.von
          const konflikt = ankunft > e.zeitfenster.bis
          return (
            <div
              key={e.pseudonymId}
              title={`${minToHHMM(ankunft)} (${minToHHMM(e.zeitfenster.von)}–${minToHHMM(e.zeitfenster.bis)})${e.probe ? ' · ' + t('probe') : ''}`}
              className="absolute top-1 flex h-7 items-center justify-center rounded px-1 text-[10px] font-medium text-white"
              data-konflikt={konflikt}
              data-probe={Boolean(e.probe)}
              style={{
                left: `${Math.max(0, Math.min(98, pct(ankunft)))}%`,
                minWidth: '34px',
                // Konflikt rot, Probe gold (gestrichelt), sonst Tinte — Symbol
                // unterscheidet zusätzlich (nie Farbe allein, /Q400/).
                backgroundColor: konflikt
                  ? 'var(--color-danger)'
                  : e.probe
                    ? 'var(--color-accent-strong)'
                    : 'var(--color-ink)',
                border: e.probe ? '1px dashed var(--color-ink)' : undefined,
              }}
            >
              {konflikt ? '⚠ ' : e.probe ? '◌ ' : ''}
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
            {e.probe ? ` (${t('probe')})` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
