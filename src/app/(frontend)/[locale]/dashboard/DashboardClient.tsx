'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import type { KlientOperativ, Tour, FitMatch } from '@/shared/domain'
import { minToHHMM } from '@/shared/time'
import { TourMap } from './TourMap'
import { Timeline } from './Timeline'
import { TourReorder } from './TourReorder'

export interface TourMitKennzahlen {
  tour: Tour
  fahrzeitMin: number
  auslastungProzent: number
  arbeitszeitMin: number
  arbzgKonform: boolean
}

// Gemeinsame Form für einplanbare Kandidaten — eigene Klienten UND offene
// Marktplatz-Bedarfe. quelle steuert nur die Kennzeichnung in der Liste.
export interface PlanKandidat {
  pseudonymId: string
  geo: { lat: number; lng: number }
  zeitfenster: { von: number; bis: number }
  dauerMin: number
  qualifikation: string[]
  pflegegrad?: number
  bezugspflege?: string // bevorzugte Pflegekraft (weiche Restriktion)
  quelle: 'klient' | 'bedarf'
}

interface Props {
  tenantId: string
  tours: TourMitKennzahlen[]
  candidates: KlientOperativ[]
  bedarfe: PlanKandidat[]
}

// Disponenten-Dashboard: Kandidaten links, Karte/Tabelle mittig, Trefferliste
// rechts. Auswahl eines Kandidaten ruft den Fit-Score; ein Klick nimmt ihn auf.
export function DashboardClient({ tenantId, tours, candidates, bedarfe }: Props) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [selected, setSelected] = useState<PlanKandidat | null>(null)
  const [matches, setMatches] = useState<FitMatch[] | null>(null)
  const [grund, setGrund] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'map' | 'table'>('map')
  const [angebotGesendet, setAngebotGesendet] = useState(false)
  const [optimierId, setOptimierId] = useState<string | null>(null)
  const [reorderId, setReorderId] = useState<string | null>(null)
  const [aufloesenBusy, setAufloesenBusy] = useState(false)
  const [vorschau, setVorschau] = useState<null | {
    tourId: string
    zuordnungen: { pseudonymId: string; zielTourId: string; mehrwegMin: number }[]
    nichtPlatzierbar: { pseudonymId: string; grund: string }[]
    impact: { tourId: string; pflegekraftId: string; fahrzeitVorherMin: number; fahrzeitNachherMin: number }[]
  }>(null)

  // Eigene Klienten in die gemeinsame Kandidatenform bringen.
  const eigene: PlanKandidat[] = candidates.map((k) => ({
    pseudonymId: k.pseudonymId,
    geo: k.geo,
    zeitfenster: k.zeitfenster,
    dauerMin: k.dauerMin,
    qualifikation: k.qualifikation,
    pflegegrad: k.pflegegrad,
    bezugspflege: k.bezugspflege,
    quelle: 'klient',
  }))

  async function waehleKandidat(k: PlanKandidat) {
    setSelected(k)
    setMatches(null)
    setGrund(null)
    setAngebotGesendet(false)
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
            bezugspflege: k.bezugspflege,
          },
        }),
      })
      const data = await res.json()
      setMatches(data.matches ?? [])
      setGrund(data.grund ?? null)
    } finally {
      setLoading(false)
    }
  }

  async function aufnehmen(match: FitMatch, probe: boolean) {
    if (!selected) return
    setLoading(true)
    try {
      await fetch('/api/v1/tours/assign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tourId: match.tourId,
          position: match.position,
          probe,
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

  // Reihenfolge einer Tour optimieren (VRPTW-Sequencing, §5.2.1).
  async function optimiere(tourId: string) {
    setOptimierId(tourId)
    try {
      const res = await fetch(`/api/v1/tours/${tourId}/optimize`, { method: 'POST' })
      // Bei Erfolg Server-Daten neu laden (Tour-Reihenfolge hat sich geändert).
      if (res.ok) startTransition(() => router.refresh())
    } finally {
      setOptimierId(null)
    }
  }

  // Krankmeldung / Tour auflösen — erst Vorschau der Umverteilung (kein Schreiben).
  async function aufloesenVorschau(tourId: string) {
    setAufloesenBusy(true)
    setVorschau(null)
    try {
      const res = await fetch(`/api/v1/tours/${tourId}/aufloesen?probe=1`, { method: 'POST' })
      if (res.ok) setVorschau({ tourId, ...(await res.json()) })
    } finally {
      setAufloesenBusy(false)
    }
  }

  // Bestätigen: Umverteilung real anwenden und Server-Daten neu laden.
  async function aufloesenBestaetigen() {
    if (!vorschau) return
    setAufloesenBusy(true)
    try {
      const res = await fetch(`/api/v1/tours/${vorschau.tourId}/aufloesen`, { method: 'POST' })
      if (res.ok) {
        setVorschau(null)
        startTransition(() => router.refresh())
      }
    } finally {
      setAufloesenBusy(false)
    }
  }

  // „Gewinnen": Angebot auf den offenen Bedarf abgeben.
  async function angebotAbgeben(bedarfId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/bedarfe/${bedarfId}/angebote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, nachricht: '' }),
      })
      if (res.ok) setAngebotGesendet(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_320px]">
      {/* Kandidatenliste: eigene Klienten + offene Marktplatz-Bedarfe */}
      <section aria-labelledby="kandidaten-h" className="card p-4">
        <h2 id="kandidaten-h" className="mb-3 font-semibold">
          {t('candidates')} ({eigene.length})
        </h2>
        <ul className="flex flex-col gap-1.5">
          {eigene.map((k) => (
            <li key={k.pseudonymId}>
              <KandidatButton
                k={k}
                aktiv={selected?.pseudonymId === k.pseudonymId}
                onClick={() => waehleKandidat(k)}
              />
            </li>
          ))}
        </ul>

        {bedarfe.length > 0 && (
          <>
            <h2 className="mt-5 mb-3 flex items-center gap-2 font-semibold">
              {t('marktKandidaten')} ({bedarfe.length})
            </h2>
            <ul className="flex flex-col gap-1.5">
              {bedarfe.map((b) => (
                <li key={b.pseudonymId}>
                  <KandidatButton
                    k={b}
                    aktiv={selected?.pseudonymId === b.pseudonymId}
                    onClick={() => waehleKandidat(b)}
                    badge={t('marktChip')}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Karte / Tabelle */}
      <section aria-labelledby="karte-h" className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="karte-h" className="font-semibold">
            {view === 'map' ? t('map') : t('mapAlt')}
          </h2>
          {/* Umschalter Karte ↔ Text-/Tabellenalternative (WCAG, /Q400/) */}
          <div role="group" aria-label={t('map') + ' / ' + t('table')} className="flex text-sm">
            <button
              onClick={() => setView('map')}
              aria-pressed={view === 'map'}
              className={`min-h-9 rounded-l-lg border px-3 py-1 font-medium transition-colors ${
                view === 'map'
                  ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                  : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-paper)]'
              }`}
            >
              {t('map')}
            </button>
            <button
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              className={`-ml-px min-h-9 rounded-r-lg border px-3 py-1 font-medium transition-colors ${
                view === 'table'
                  ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                  : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-paper)]'
              }`}
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

        {/* Zeitstrahl je Tour + „Tour optimieren" (Reihenfolge neu berechnen) */}
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-muted)]">{t('timeline')}</h3>
          {tours.map((x) => (
            <div key={x.tour.id} className="mb-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{x.tour.pflegekraftId}</span>
                <span className="flex gap-2">
                  {x.tour.einsaetze.length > 1 && (
                    <button
                      onClick={() => setReorderId(reorderId === x.tour.id ? null : x.tour.id)}
                      disabled={aufloesenBusy || optimierId !== null}
                      aria-pressed={reorderId === x.tour.id}
                      className="btn btn-outline min-h-8 px-3 py-1 text-xs"
                    >
                      {t('reihenfolge')}
                    </button>
                  )}
                  {x.tour.einsaetze.length > 0 && (
                    <button
                      onClick={() => aufloesenVorschau(x.tour.id)}
                      disabled={aufloesenBusy || optimierId !== null}
                      className="btn btn-outline min-h-8 px-3 py-1 text-xs"
                    >
                      {t('aufloesen')}
                    </button>
                  )}
                  {x.tour.einsaetze.length > 1 && (
                    <button
                      onClick={() => optimiere(x.tour.id)}
                      disabled={optimierId !== null || aufloesenBusy}
                      className="btn btn-outline min-h-8 px-3 py-1 text-xs"
                    >
                      {optimierId === x.tour.id ? t('optimiert') : t('optimieren')}
                    </button>
                  )}
                </span>
              </div>
              <Timeline tour={x.tour} />

              {/* Drag&Drop-Umsortierung mit Live-Vorschau (§5.2.3). */}
              {reorderId === x.tour.id && (
                <TourReorder
                  tour={x.tour}
                  onClose={(gespeichert) => {
                    setReorderId(null)
                    if (gespeichert) startTransition(() => router.refresh())
                  }}
                />
              )}

              {/* Vorschau der Umverteilung (Krankmeldung) für diese Tour. */}
              {vorschau?.tourId === x.tour.id && (
                <div className="mt-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
                  <p className="text-sm font-medium">{t('aufloesenTitel')}</p>
                  <p className="mt-1 text-sm text-[var(--color-success)]">
                    {t('umverteilt', { n: vorschau.zuordnungen.length })}
                  </p>
                  {vorschau.impact.map((im) => (
                    <p key={im.tourId} className="text-xs text-[var(--color-muted)]">
                      {im.pflegekraftId}: {t('tourDuration')} {im.fahrzeitVorherMin} → {im.fahrzeitNachherMin} {t('minutes')}
                    </p>
                  ))}
                  {vorschau.nichtPlatzierbar.length > 0 && (
                    <p className="mt-1 text-sm font-medium text-[var(--color-danger)]">
                      ⚠ {t('nichtPlatzierbar', { n: vorschau.nichtPlatzierbar.length })}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button onClick={aufloesenBestaetigen} disabled={aufloesenBusy} className="btn btn-primary min-h-9 px-3 py-1 text-sm">
                      {t('bestaetigen')}
                    </button>
                    <button onClick={() => setVorschau(null)} disabled={aufloesenBusy} className="btn btn-outline min-h-9 px-3 py-1 text-sm">
                      {t('abbrechen')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Trefferliste (Fit-Score) */}
      <section aria-labelledby="treffer-h" aria-live="polite" className="card p-4">
        <h2 id="treffer-h" className="mb-3 font-semibold">
          {t('matches')}
        </h2>
        {!selected && <p className="text-sm text-[var(--color-faint)]">{t('noSelection')}</p>}
        {loading && <p className="text-sm text-[var(--color-faint)]">{t('calculating')}</p>}
        {selected && !loading && matches && matches.length === 0 && (
          <p className="text-sm font-medium text-[var(--color-danger)]">
            ⚠ {t(grund ? `noMatch_${grund}` : 'noMatch')}
          </p>
        )}

        {/* Marktplatz-Bedarf: Hinweis + „gewinnen" (Angebot abgeben). */}
        {selected?.quelle === 'bedarf' && (
          <div className="mb-3 rounded-lg bg-[var(--color-accent-soft)] p-3">
            <p className="text-xs text-[var(--color-muted)]">{t('probeHinweis')}</p>
            {angebotGesendet ? (
              <p className="mt-2 text-sm font-medium text-[var(--color-success)]">
                ✓ {t('angebotGesendet')}
              </p>
            ) : (
              <button
                onClick={() => angebotAbgeben(selected.pseudonymId)}
                disabled={loading}
                className="btn btn-accent mt-2 w-full"
              >
                {t('gewinnen')}
              </button>
            )}
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {matches?.map((mm) => (
            <li key={mm.tourId} className="rounded-lg border border-[var(--color-line)] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{mm.pflegekraftId}</span>
                <span className="text-lg font-bold text-[var(--color-success)]">
                  +{mm.mehrwegMin} {t('minutes')}
                </span>
              </div>
              <p className="text-sm text-[var(--color-muted)]">
                {t('detour')} · {t('position')} {mm.position + 1} ·{' '}
                {t('minutes')} {minToHHMM(mm.ankunft)}
              </p>
              <p className="text-xs font-medium text-[var(--color-success)]">✓ {t('qualificationOk')}</p>
              {mm.bezugspflegeErfuellt && (
                <p className="text-xs font-medium text-[var(--color-accent-strong)]">★ {t('bezugspflegeOk')}</p>
              )}
              <p className="text-xs text-[var(--color-muted)]">
                {t('arbeitszeit')} {minToHHMM(mm.arbeitszeitMin)} h
              </p>
              <button
                onClick={() => aufnehmen(mm, selected?.quelle === 'bedarf')}
                disabled={loading}
                className={`mt-2 w-full ${selected?.quelle === 'bedarf' ? 'btn btn-outline' : 'btn btn-primary'}`}
              >
                {selected?.quelle === 'bedarf' ? t('probeEinplanen') : t('assign')}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// Kandidaten-Button (eigener Klient oder Marktplatz-Bedarf, via badge markiert).
function KandidatButton({
  k,
  aktiv,
  onClick,
  badge,
}: {
  k: PlanKandidat
  aktiv: boolean
  onClick: () => void
  badge?: string
}) {
  const t = useTranslations('dashboard')
  return (
    <button
      onClick={onClick}
      aria-pressed={aktiv}
      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        aktiv
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
          : 'border-[var(--color-line)] hover:bg-[var(--color-paper)]'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {minToHHMM(k.zeitfenster.von)}–{minToHHMM(k.zeitfenster.bis)}
        </span>
        {badge && <span className="chip">{badge}</span>}
      </span>
      <span className="block text-[var(--color-faint)]">
        PG {k.pflegegrad ?? '–'} · {k.qualifikation.join(', ') || '—'} · {k.dauerMin}{' '}
        {t('minutes')}
      </span>
    </button>
  )
}

// Text-/Tabellenalternative zur Karte — liefert dieselbe Information (/Q400/).
function TourTable({ tours }: { tours: TourMitKennzahlen[] }) {
  const t = useTranslations('dashboard')
  return (
    <div className="overflow-x-auto">
      {tours.map((x) => (
        <div key={x.tour.id} className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--color-muted)]">
            {x.tour.pflegekraftId} — {x.tour.datum} · {t('tourDuration')} {x.fahrzeitMin}{' '}
            {t('minutes')} · {t('utilization')} {x.auslastungProzent}% · {t('arbeitszeit')}{' '}
            {minToHHMM(x.arbeitszeitMin)} h
            {!x.arbzgKonform && (
              <span className="ml-2 font-medium text-[var(--color-danger)]">⚠ {t('arbzgWarnung')}</span>
            )}
          </h3>
          <table className="mt-1 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                <th className="py-1 pr-3">#</th>
                <th className="py-1 pr-3">{t('minutes')}</th>
                <th className="py-1 pr-3">PG</th>
                <th className="py-1 pr-3">Qual.</th>
              </tr>
            </thead>
            <tbody>
              {x.tour.einsaetze.map((e, i) => (
                <tr key={e.pseudonymId} className="border-b border-[var(--color-line)]">
                  <td className="py-1 pr-3">{i + 1}</td>
                  <td className="py-1 pr-3">
                    {e.ankunft != null ? minToHHMM(e.ankunft) : '—'}
                  </td>
                  <td className="py-1 pr-3">{e.dauerMin}</td>
                  <td className="py-1 pr-3">
                    {e.qualifikation.join(', ') || '—'}
                    {e.probe && <span className="chip ml-1">{t('probe')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
