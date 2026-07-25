'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { minToHHMM } from '@/shared/time'
import { idbGet, idbSet } from './idb'
import { enqueue, flushQueue, type ErfassungAktion } from './queue'

interface StoppView {
  pseudonymId: string
  geo: { lat: number; lng: number }
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

const QUEUE_KEY = 'queue'
const TOUREN_KEY = 'touren'

function heuteISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function jetztMin(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

// Sendet eine Aktion an den passenden Endpoint. true = angenommen/dedupliziert.
async function sende(a: ErfassungAktion): Promise<boolean> {
  const url =
    a.event === 'erledigt' ? `/api/v1/tours/${a.tourId}/bestaetigung` : `/api/v1/tours/${a.tourId}/erfassung`
  const body =
    a.event === 'erledigt'
      ? { pseudonymId: a.pseudonymId, zeit: a.zeit, aktionId: a.aktionId }
      : { pseudonymId: a.pseudonymId, event: a.event, zeit: a.zeit, grund: a.grund, aktionId: a.aktionId }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok
}

// Mobile Leistungserfassung als Offline-fähige PWA (§5.3): spiegelt die
// Tagestour in IndexedDB, erfasst offline in eine Warteschlange und synchronisiert
// automatisch bei Verbindung. Erfassungen tragen eine aktionId → idempotent.
export function ErfassungPwa() {
  const t = useTranslations('erfassung')
  const [touren, setTouren] = useState<TourView[] | null>(null)
  const [warteschlange, setWarteschlange] = useState(0)
  const [online, setOnline] = useState(true)
  const [busy, setBusy] = useState(false)

  // Warteschlange abarbeiten (IndexedDB → Server), Rest zurückschreiben.
  const flush = useCallback(async () => {
    const queue = (await idbGet<ErfassungAktion[]>(QUEUE_KEY)) ?? []
    if (queue.length === 0) {
      setWarteschlange(0)
      return
    }
    const { verbleibend } = await flushQueue(queue, sende)
    await idbSet(QUEUE_KEY, verbleibend)
    setWarteschlange(verbleibend.length)
  }, [])

  // Tagestour laden: online vom Server (+ in IndexedDB spiegeln), sonst aus IndexedDB.
  const synchronisiere = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/erfassung/heute?datum=${heuteISO()}`)
      if (!res.ok) throw new Error('offline')
      const d = await res.json()
      setTouren(d.touren)
      await idbSet(TOUREN_KEY, d.touren)
    } catch {
      setTouren((await idbGet<TourView[]>(TOUREN_KEY)) ?? [])
    }
    await flush()
  }, [flush])

  useEffect(() => {
    setOnline(navigator.onLine)
    void (async () => {
      setWarteschlange(((await idbGet<ErfassungAktion[]>(QUEUE_KEY)) ?? []).length)
      await synchronisiere()
    })()
    const onOnline = () => {
      setOnline(true)
      void flush()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [synchronisiere, flush])

  // Aktion optimistisch anwenden, in IndexedDB einreihen und (best effort) senden.
  async function erfasse(tourId: string, s: StoppView, event: ErfassungAktion['event'], grund?: string) {
    setBusy(true)
    try {
      const aktion: ErfassungAktion = {
        aktionId: crypto.randomUUID(),
        tourId,
        pseudonymId: s.pseudonymId,
        event,
        zeit: event === 'abweichung' ? undefined : jetztMin(),
        grund,
      }
      // Optimistisches lokales Update.
      setTouren((prev) =>
        (prev ?? []).map((tr) =>
          tr.id !== tourId
            ? tr
            : {
                ...tr,
                einsaetze: tr.einsaetze.map((e) =>
                  e.pseudonymId !== s.pseudonymId
                    ? e
                    : event === 'ankunft'
                      ? { ...e, istAnkunft: aktion.zeit ?? null }
                      : event === 'erledigt'
                        ? { ...e, erledigt: true }
                        : e,
                ),
              },
        ),
      )
      const queue = enqueue((await idbGet<ErfassungAktion[]>(QUEUE_KEY)) ?? [], aktion)
      await idbSet(QUEUE_KEY, queue)
      setWarteschlange(queue.length)
      await flush()
    } finally {
      setBusy(false)
    }
  }

  function navigiere(geo: { lat: number; lng: number }) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${geo.lat},${geo.lng}`, '_blank')
  }

  function abweichung(tourId: string, s: StoppView) {
    const grund = window.prompt(t('abweichungFrage'))
    if (grund && grund.trim()) void erfasse(tourId, s, 'abweichung', grund.trim())
  }

  if (touren === null) return <p className="text-sm text-[var(--color-muted)]">{t('lade')}</p>
  if (touren.length === 0) return <p className="text-sm text-[var(--color-muted)]">{t('keineTouren')}</p>

  return (
    <div className="flex flex-col gap-5">
      {/* Verbindungs-/Sync-Status */}
      <div className="flex items-center justify-between text-sm">
        <span className={online ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
          {online ? t('online') : t('offline')}
        </span>
        {warteschlange > 0 && (
          <span className="text-[var(--color-muted)]">{t('ausstehend', { n: warteschlange })}</span>
        )}
      </div>

      {touren.map((tr) => (
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
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => navigiere(e.geo)} className="btn btn-outline min-h-12 flex-1 text-base">
                    {t('navigieren')}
                  </button>
                  {!e.erledigt && (
                    <>
                      <button
                        onClick={() => erfasse(tr.id, e, 'ankunft')}
                        disabled={busy || e.istAnkunft !== null}
                        className="btn btn-outline min-h-12 flex-1 text-base"
                      >
                        {t('angekommen')}
                      </button>
                      <button
                        onClick={() => erfasse(tr.id, e, 'erledigt')}
                        disabled={busy}
                        className="btn btn-primary min-h-12 flex-1 text-base"
                      >
                        {t('fertig')}
                      </button>
                      <button
                        onClick={() => abweichung(tr.id, e)}
                        disabled={busy}
                        className="btn btn-outline min-h-12 text-base"
                      >
                        {t('abweichung')}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
