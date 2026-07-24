'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Tour, Einsatz } from '@/shared/domain'
import { minToHHMM } from '@/shared/time'

type StopStatus = { pseudonymId: string; ankunft: number; zeitfensterOk: boolean }
interface Vorschau {
  fahrzeitMin: number
  arbeitszeitMin: number
  auslastungProzent: number
  arbzgKonform: boolean
  stops: StopStatus[]
}

// Ziehbare Stopp-Liste einer Tour (§5.2.3): Umsortieren per Drag&Drop ODER per
// Hoch/Runter (tastaturbedienbar, WCAG). Jeder Drop holt eine Server-Vorschau
// (kein Schreiben) und zeigt sofort Fahrzeit und Zeitfenster-Verletzungen rot.
// „Speichern" persistiert die aktuelle Reihenfolge.
export function TourReorder({
  tour,
  onClose,
}: {
  tour: Tour
  onClose: (gespeichert: boolean) => void
}) {
  const t = useTranslations('dashboard')
  const [order, setOrder] = useState<Einsatz[]>(tour.einsaetze)
  const [vorschau, setVorschau] = useState<Vorschau | null>(null)
  const [busy, setBusy] = useState(false)
  const [geaendert, setGeaendert] = useState(false)
  const dragIndex = useRef<number | null>(null)

  async function bewerte(neu: Einsatz[]) {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/tours/${tour.id}/reorder`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reihenfolge: neu.map((e) => e.pseudonymId), probe: true }),
      })
      if (res.ok) setVorschau(await res.json())
    } finally {
      setBusy(false)
    }
  }

  // Initiale Vorschau für die aktuelle Reihenfolge.
  useEffect(() => {
    void bewerte(tour.einsaetze)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function verschiebe(from: number, to: number) {
    if (from === to || to < 0 || to >= order.length) return
    const neu = [...order]
    const [m] = neu.splice(from, 1)
    neu.splice(to, 0, m)
    setOrder(neu)
    setGeaendert(true)
    void bewerte(neu)
  }

  async function speichern() {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/tours/${tour.id}/reorder`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reihenfolge: order.map((e) => e.pseudonymId) }),
      })
      if (res.ok) onClose(true)
    } finally {
      setBusy(false)
    }
  }

  const statusVon = (id: string) => vorschau?.stops.find((s) => s.pseudonymId === id)

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t('reihenfolgeTitel')}</span>
        {vorschau && (
          <span className="text-sm text-[var(--color-muted)]">
            {t('tourDuration')} {vorschau.fahrzeitMin} {t('minutes')}
            {!vorschau.arbzgKonform && (
              <span className="ml-2 font-medium text-[var(--color-danger)]">⚠ {t('arbzgWarnung')}</span>
            )}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {order.map((e, i) => {
          const st = statusVon(e.pseudonymId)
          const verletzt = st ? !st.zeitfensterOk : false
          return (
            <li
              key={e.pseudonymId}
              draggable
              onDragStart={() => {
                dragIndex.current = i
              }}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={() => {
                const from = dragIndex.current
                dragIndex.current = null
                if (from !== null) verschiebe(from, i)
              }}
              className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm ${
                verletzt ? 'border-[var(--color-danger)]' : 'border-[var(--color-line)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className="cursor-grab text-[var(--color-faint)]">
                  ⋮⋮
                </span>
                <span className="font-medium">{i + 1}.</span>
                <span>
                  {minToHHMM(e.zeitfenster.von)}–{minToHHMM(e.zeitfenster.bis)}
                </span>
                {st && (
                  <span className={verletzt ? 'font-medium text-[var(--color-danger)]' : 'text-[var(--color-muted)]'}>
                    {verletzt ? '⚠ ' : ''}
                    {t('minutes')} {minToHHMM(st.ankunft)}
                  </span>
                )}
              </span>
              <span className="flex gap-1">
                <button
                  aria-label={t('hoch')}
                  disabled={i === 0 || busy}
                  onClick={() => verschiebe(i, i - 1)}
                  className="btn btn-outline min-h-7 px-2 py-0.5 text-xs"
                >
                  ↑
                </button>
                <button
                  aria-label={t('runter')}
                  disabled={i === order.length - 1 || busy}
                  onClick={() => verschiebe(i, i + 1)}
                  className="btn btn-outline min-h-7 px-2 py-0.5 text-xs"
                >
                  ↓
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 flex gap-2">
        <button onClick={speichern} disabled={busy || !geaendert} className="btn btn-primary min-h-9 px-3 py-1 text-sm">
          {t('speichern')}
        </button>
        <button onClick={() => onClose(false)} disabled={busy} className="btn btn-outline min-h-9 px-3 py-1 text-sm">
          {t('abbrechen')}
        </button>
      </div>
    </div>
  )
}
