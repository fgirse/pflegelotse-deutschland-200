'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import type { KlientOperativ, Tour, FitMatch } from '@/shared/domain'
import { minToHHMM } from '@/shared/time'
import { TourMap } from './TourMap'
import { Timeline } from './Timeline'

export interface TourMitKennzahlen {
  tour: Tour
  fahrzeitMin: number
  auslastungProzent: number
}

interface Props {
  tenantId: string
  tours: TourMitKennzahlen[]
  candidates: KlientOperativ[]
}

// Disponenten-Dashboard: Kandidaten links, Karte/Tabelle mittig, Trefferliste
// rechts. Auswahl eines Kandidaten ruft den Fit-Score; ein Klick nimmt ihn auf.
export function DashboardClient({ tenantId, tours, candidates }: Props) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [selected, setSelected] = useState<KlientOperativ | null>(null)
  const [matches, setMatches] = useState<FitMatch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'map' | 'table'>('map')

  async function waehleKandidat(k: KlientOperativ) {
    setSelected(k)
    setMatches(null)
    setLoading(true)
    try {
      const res = await fetch('/api/v1/matching/fit-score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          kandidat: {
            pseudonymId: k.pseudonymId,
            geo: k.geo,
            zeitfenster: k.zeitfenster,
            dauerMin: k.dauerMin,
            qualifikation: k.qualifikation,
          },
        }),
      })
      const data = await res.json()
      setMatches(data.matches ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function aufnehmen(match: FitMatch) {
    if (!selected) return
    setLoading(true)
    try {
      await fetch('/api/v1/tours/assign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tourId: match.tourId,
          position: match.position,
          kandidat: {
            pseudonymId: selected.pseudonymId,
            geo: selected.geo,
            zeitfenster: selected.zeitfenster,
            dauerMin: selected.dauerMin,
            qualifikation: selected.qualifikation,
          },
        }),
      })
      setSelected(null)
      setMatches(null)
      // Server-Daten neu laden (Tour hat sich geändert).
      startTransition(() => router.refresh())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_320px]">
      {/* Kandidatenliste */}
      <section aria-labelledby="kandidaten-h" className="rounded-lg border bg-white p-3">
        <h2 id="kandidaten-h" className="mb-2 font-semibold">
          {t('candidates')} ({candidates.length})
        </h2>
        <ul className="flex flex-col gap-1">
          {candidates.map((k) => {
            const aktiv = selected?.pseudonymId === k.pseudonymId
            return (
              <li key={k.pseudonymId}>
                <button
                  onClick={() => waehleKandidat(k)}
                  aria-pressed={aktiv}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    aktiv ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium">
                    {minToHHMM(k.zeitfenster.von)}–{minToHHMM(k.zeitfenster.bis)}
                  </span>
                  <span className="block text-slate-500">
                    PG {k.pflegegrad ?? '–'} · {k.qualifikation.join(', ') || '—'} ·{' '}
                    {k.dauerMin} {t('minutes')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Karte / Tabelle */}
      <section aria-labelledby="karte-h" className="rounded-lg border bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="karte-h" className="font-semibold">
            {view === 'map' ? t('map') : t('mapAlt')}
          </h2>
          {/* Umschalter Karte ↔ Text-/Tabellenalternative (WCAG, /Q400/) */}
          <div role="group" aria-label={t('map') + ' / ' + t('table')} className="text-sm">
            <button
              onClick={() => setView('map')}
              aria-pressed={view === 'map'}
              className={`rounded-l-md border px-3 py-1 ${view === 'map' ? 'bg-blue-700 text-white' : 'bg-white'}`}
            >
              {t('map')}
            </button>
            <button
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              className={`rounded-r-md border px-3 py-1 ${view === 'table' ? 'bg-blue-700 text-white' : 'bg-white'}`}
            >
              {t('table')}
            </button>
          </div>
        </div>

        {view === 'map' ? (
          <TourMap tours={tours.map((x) => x.tour)} selected={selected} />
        ) : (
          <TourTable tours={tours} />
        )}

        {/* Zeitstrahl je Tour */}
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{t('timeline')}</h3>
          {tours.map((x) => (
            <Timeline key={x.tour.id} tour={x.tour} />
          ))}
        </div>
      </section>

      {/* Trefferliste (Fit-Score) */}
      <section aria-labelledby="treffer-h" aria-live="polite" className="rounded-lg border bg-white p-3">
        <h2 id="treffer-h" className="mb-2 font-semibold">
          {t('matches')}
        </h2>
        {!selected && <p className="text-sm text-slate-500">{t('noSelection')}</p>}
        {loading && <p className="text-sm text-slate-500">{t('calculating')}</p>}
        {selected && !loading && matches && matches.length === 0 && (
          <p className="text-sm text-amber-700">{t('noMatch')}</p>
        )}
        <ul className="flex flex-col gap-2">
          {matches?.map((mm) => (
            <li key={mm.tourId} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{mm.pflegekraftId}</span>
                <span className="text-lg font-bold text-green-700">
                  +{mm.mehrwegMin} {t('minutes')}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {t('detour')} · {t('position')} {mm.position + 1} ·{' '}
                {t('minutes')} {minToHHMM(mm.ankunft)}
              </p>
              <p className="text-xs text-green-700">✓ {t('qualificationOk')}</p>
              <button
                onClick={() => aufnehmen(mm)}
                disabled={loading}
                className="mt-2 w-full rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
              >
                {t('assign')}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// Text-/Tabellenalternative zur Karte — liefert dieselbe Information (/Q400/).
function TourTable({ tours }: { tours: TourMitKennzahlen[] }) {
  const t = useTranslations('dashboard')
  return (
    <div className="overflow-x-auto">
      {tours.map((x) => (
        <div key={x.tour.id} className="mb-4">
          <h3 className="text-sm font-semibold">
            {x.tour.pflegekraftId} — {x.tour.datum} · {t('tourDuration')} {x.fahrzeitMin}{' '}
            {t('minutes')} · {t('utilization')} {x.auslastungProzent}%
          </h3>
          <table className="mt-1 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1 pr-3">#</th>
                <th className="py-1 pr-3">{t('minutes')}</th>
                <th className="py-1 pr-3">PG</th>
                <th className="py-1 pr-3">Qual.</th>
              </tr>
            </thead>
            <tbody>
              {x.tour.einsaetze.map((e, i) => (
                <tr key={e.pseudonymId} className="border-b">
                  <td className="py-1 pr-3">{i + 1}</td>
                  <td className="py-1 pr-3">
                    {e.ankunft != null ? minToHHMM(e.ankunft) : '—'}
                  </td>
                  <td className="py-1 pr-3">{e.dauerMin}</td>
                  <td className="py-1 pr-3">{e.qualifikation.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
