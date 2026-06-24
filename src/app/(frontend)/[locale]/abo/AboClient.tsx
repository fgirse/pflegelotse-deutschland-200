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
      <section className="rounded-lg border bg-white p-4" aria-live="polite">
        <h2 className="font-semibold">{t('aktuellerStatus')}</h2>
        {status ? (
          <p className="mt-1 text-sm">
            {status.stufe} — <strong>{statusText(status.status)}</strong>
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">{t('keinAbo')}</p>
        )}
      </section>

      {/* Tarife */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiers.map((tier) => {
          const istAktiv = status?.status === 'aktiv' && status.stufe === tier.key
          return (
            <div key={tier.key} className="flex flex-col rounded-lg border bg-white p-4">
              <h3 className="font-semibold">{tier.label}</h3>
              <p className="mt-1 text-2xl font-bold">
                {tier.preisText}
                <span className="text-sm font-normal text-slate-500"> {t('proMonat')}</span>
              </p>
              <button
                onClick={() => abonnieren(tier.key)}
                disabled={busy !== null || istAktiv}
                className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {istAktiv ? t('aktiv') : busy === tier.key ? t('laedt') : t('abonnieren')}
              </button>
            </div>
          )
        })}
      </section>

      <p className="text-xs text-slate-500">{t('hinweisErstzahlung')}</p>
    </div>
  )
}
