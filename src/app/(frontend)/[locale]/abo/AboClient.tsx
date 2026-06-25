'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Tier {
  key: 'klein' | 'mittel' | 'gross'
  label: string
  preisText: string
}

interface AboStatus {
  stufe: string
  status: string
  monatlichCents: number
  aktivSeit: string | null
}

interface Props {
  tenantId: string
  tiers: Tier[]
  status: AboStatus | null
}

export function AboClient({ tenantId, tiers, status }: Props) {
  const t = useTranslations('abo')
  const [busy, setBusy] = useState<string | null>(null)

  async function abonnieren(stufe: Tier['key']) {
    setBusy(stufe)
    try {
      const res = await fetch('/api/v1/billing/abo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, stufe }),
      })
      const data = await res.json()
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        setBusy(null)
      }
    } catch {
      setBusy(null)
    }
  }

  // Statustext lokalisiert.
  const statusText = (s: string) =>
    ({ ausstehend: t('ausstehend'), aktiv: t('aktiv'), gekuendigt: t('gekuendigt'), fehlgeschlagen: t('fehlgeschlagen') })[
      s
    ] ?? s

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Aktueller Status */}
      <section className="card p-4" aria-live="polite">
        <h2 className="font-semibold">{t('aktuellerStatus')}</h2>
        {status ? (
          <p className="mt-1 text-sm">
            {status.stufe} — <strong>{statusText(status.status)}</strong>
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--color-faint)]">{t('keinAbo')}</p>
        )}
      </section>

      {/* Tarife */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiers.map((tier) => {
          const istAktiv = status?.status === 'aktiv' && status.stufe === tier.key
          return (
            <div
              key={tier.key}
              className={`card flex flex-col p-5 ${istAktiv ? 'border-2 border-[var(--color-accent-strong)]' : ''}`}
            >
              <h3 className="font-display font-semibold">{tier.label}</h3>
              <p className="mt-1 font-display text-3xl font-bold">
                {tier.preisText}
                <span className="text-sm font-normal text-[var(--color-faint)]"> {t('proMonat')}</span>
              </p>
              <button
                onClick={() => abonnieren(tier.key)}
                disabled={busy !== null || istAktiv}
                className="btn btn-accent mt-4"
              >
                {istAktiv ? t('aktiv') : busy === tier.key ? t('laedt') : t('abonnieren')}
              </button>
            </div>
          )
        })}
      </section>

      <p className="text-xs text-[var(--color-faint)]">{t('hinweisErstzahlung')}</p>
    </div>
  )
}
