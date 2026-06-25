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
      <h1 className="text-3xl font-bold">{t('angeboteTitel')}</h1>

      {gewaehlt && (
        <p className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-[var(--color-success)]">{t('vergebenHinweis')}</p>
      )}

      {/* Express-Upsell (/F1020/) — einmalige Zahlung über Mollie. */}
      {!gewaehlt && (
        <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-accent-soft)] p-4">
          <p className="text-sm text-[var(--color-accent)]">{t('expressHinweis')}</p>
          <button
            onClick={expressFreischalten}
            disabled={expressBusy}
            className="btn btn-accent mt-3"
          >
            {expressBusy ? t('expressLaedt') : t('expressFreischalten')}
          </button>
        </div>
      )}

      {!gewaehlt && angebote.length === 0 && (
        <p className="mt-4 text-[var(--color-faint)]">{t('nochKeine')}</p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {angebote.map((a) => (
          <li key={a.id} className="card p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-display font-semibold">{a.tenantId}</span>
              {typeof a.mehrwegMin === 'number' && (
                <span className="chip">+{a.mehrwegMin} Min</span>
              )}
            </div>
            {a.nachricht && <p className="mt-1 text-sm text-[var(--color-muted)]">{a.nachricht}</p>}
            {gewaehlt === a.tenantId ? (
              <p className="mt-2 font-medium text-[var(--color-success)]">✓ {t('gewaehlt')}</p>
            ) : (
              <button
                onClick={() => waehlen(a.tenantId)}
                disabled={busy || Boolean(gewaehlt)}
                className="btn btn-primary mt-3 w-full"
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
