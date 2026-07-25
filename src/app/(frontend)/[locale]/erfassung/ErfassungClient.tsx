'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { minToHHMM } from '@/shared/time'

interface StoppView {
  pseudonymId: string
  zeitfenster: { von: number; bis: number }
  istAnkunft: number | null
  erledigt: boolean
}
interface TourView {
  id: string
  pflegekraftId: string
  datum: string
  einsaetze: StoppView[]
}

// Aktuelle Gerätezeit in Minuten seit Mitternacht (lokale Zeit der Pflegekraft).
function jetztMin(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

// Mobile Leistungserfassung (§5.3): pro Stopp große, handschuhtaugliche Buttons.
// Ein Klick stempelt die aktuelle Gerätezeit (automatische Zeitstempelung) und
// meldet sie an den Server.
export function ErfassungClient({ touren }: { touren: TourView[] }) {
  const t = useTranslations('erfassung')
  const [state, setState] = useState<TourView[]>(touren)
  const [busy, setBusy] = useState<string | null>(null)

  async function stempeln(tourId: string, pseudonymId: string, event: 'ankunft' | 'erledigt') {
    const zeit = jetztMin()
    setBusy(pseudonymId + event)
    try {
      // „Erledigt" schreibt den revisionssicheren Leistungsnachweis (§5.4);
      // „Angekommen" nur den Ist-Zeitstempel (§5.3).
      const url =
        event === 'erledigt'
          ? `/api/v1/tours/${tourId}/bestaetigung`
          : `/api/v1/tours/${tourId}/erfassung`
      const body = event === 'erledigt' ? { pseudonymId, zeit } : { pseudonymId, event, zeit }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      // Lokalen Zustand aktualisieren (optimistisch bestätigt).
      setState((prev) =>
        prev.map((tr) =>
          tr.id !== tourId
            ? tr
            : {
                ...tr,
                einsaetze: tr.einsaetze.map((e) =>
                  e.pseudonymId !== pseudonymId
                    ? e
                    : event === 'ankunft'
                      ? { ...e, istAnkunft: zeit }
                      : { ...e, erledigt: true },
                ),
              },
        ),
      )
    } finally {
      setBusy(null)
    }
  }

  if (state.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">{t('keineTouren')}</p>
  }

  return (
    <div className="flex flex-col gap-5">
      {state.map((tr) => (
        <section key={tr.id} className="card p-4">
          <h2 className="mb-3 font-semibold">
            {tr.pflegekraftId} · {tr.datum}
          </h2>
          <ul className="flex flex-col gap-3">
            {tr.einsaetze.map((e, i) => (
              <li key={e.pseudonymId} className="rounded-lg border border-[var(--color-line)] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {i + 1}. {minToHHMM(e.zeitfenster.von)}–{minToHHMM(e.zeitfenster.bis)}
                  </span>
                  {e.erledigt ? (
                    <span className="text-sm font-medium text-[var(--color-success)]">✓ {t('erledigt')}</span>
                  ) : e.istAnkunft !== null ? (
                    <span className="text-sm text-[var(--color-muted)]">
                      {t('angekommenUm', { zeit: minToHHMM(e.istAnkunft) })}
                    </span>
                  ) : null}
                </div>
                {!e.erledigt && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => stempeln(tr.id, e.pseudonymId, 'ankunft')}
                      disabled={busy !== null || e.istAnkunft !== null}
                      className="btn btn-outline min-h-14 flex-1 text-base"
                    >
                      {t('angekommen')}
                    </button>
                    <button
                      onClick={() => stempeln(tr.id, e.pseudonymId, 'erledigt')}
                      disabled={busy !== null}
                      className="btn btn-primary min-h-14 flex-1 text-base"
                    >
                      {t('fertig')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
