'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface Angebot {
  id: string
  tenantId: string
  nachricht?: string
  mehrwegMin?: number
}

// Angehörigen-Ansicht: Angebote vergleichen und einen Dienst wählen.
// Nach der Wahl gibt das System die Kontaktdaten an genau diesen Dienst frei.
export function AngeboteView({ bedarfId }: { bedarfId: string }) {
  const t = useTranslations('markt')
  const [angebote, setAngebote] = useState<Angebot[]>([])
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expressBusy, setExpressBusy] = useState(false)

  async function expressFreischalten() {
    setExpressBusy(true)
    try {
      const res = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bedarfId }),
      })
      const data = await res.json()
      if (data.checkoutUrl) {
        // Weiterleitung zur gehosteten Mollie-Bezahlseite.
        window.location.href = data.checkoutUrl
      } else {
        setExpressBusy(false)
      }
    } catch {
      setExpressBusy(false)
    }
  }

  const laden = useCallback(async () => {
    const res = await fetch(`/api/v1/bedarfe/${bedarfId}/angebote`)
    const data = await res.json()
    setAngebote(data.angebote ?? [])
  }, [bedarfId])

  useEffect(() => {
    laden()
  }, [laden])

  async function waehlen(tenantId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/bedarfe/${bedarfId}/select`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      if (res.ok) setGewaehlt(tenantId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-live="polite">
      <h1 className="text-2xl font-bold">{t('angeboteTitel')}</h1>

      {gewaehlt && (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-green-900">{t('vergebenHinweis')}</p>
      )}

      {/* Express-Upsell (/F1020/) — einmalige Zahlung über Mollie. */}
      {!gewaehlt && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">{t('expressHinweis')}</p>
          <button
            onClick={expressFreischalten}
            disabled={expressBusy}
            className="mt-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {expressBusy ? t('expressLaedt') : t('expressFreischalten')}
          </button>
        </div>
      )}

      {!gewaehlt && angebote.length === 0 && (
        <p className="mt-4 text-slate-500">{t('nochKeine')}</p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {angebote.map((a) => (
          <li key={a.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{a.tenantId}</span>
              {typeof a.mehrwegMin === 'number' && (
                <span className="text-sm text-slate-500">+{a.mehrwegMin} Min</span>
              )}
            </div>
            {a.nachricht && <p className="mt-1 text-sm text-slate-700">{a.nachricht}</p>}
            {gewaehlt === a.tenantId ? (
              <p className="mt-2 font-medium text-green-700">✓ {t('gewaehlt')}</p>
            ) : (
              <button
                onClick={() => waehlen(a.tenantId)}
                disabled={busy || Boolean(gewaehlt)}
                className="mt-3 w-full rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {t('waehlen')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
