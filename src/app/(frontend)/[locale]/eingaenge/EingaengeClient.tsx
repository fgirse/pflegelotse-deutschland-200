'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { minToHHMM } from '@/shared/time'

interface OffenerBedarf {
  pseudonymId: string
  pflegegrad?: number
  qualifikation: string[]
  zeitfenster: { von: number; bis: number }
  dauerMin: number
  express: boolean
  status: string
}

interface Props {
  tenantId: string
  offene: OffenerBedarf[]
  gewonnen: { pseudonymId: string }[]
}

// Dienst-Seite: anonyme Bedarfe mit „Angebot abgeben" und gewonnene Bedarfe,
// bei denen der freigegebene Kontakt abrufbar ist.
export function EingaengeClient({ tenantId, offene, gewonnen }: Props) {
  const t = useTranslations('markt')
  const router = useRouter()
  const [nachrichten, setNachrichten] = useState<Record<string, string>>({})
  const [gesendet, setGesendet] = useState<Record<string, boolean>>({})
  const [kontakte, setKontakte] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function angebotAbgeben(bedarfId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/bedarfe/${bedarfId}/angebote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, nachricht: nachrichten[bedarfId] ?? '' }),
      })
      if (res.ok) {
        setGesendet((g) => ({ ...g, [bedarfId]: true }))
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  async function kontaktLaden(bedarfId: string) {
    const res = await fetch(`/api/v1/bedarfe/${bedarfId}/kontakt?tenantId=${tenantId}`)
    if (res.ok) {
      const { kontakt } = await res.json()
      setKontakte((k) => ({
        ...k,
        [bedarfId]: `${kontakt.vorname} ${kontakt.nachname} · ${kontakt.telefon}${kontakt.email ? ' · ' + kontakt.email : ''}`,
      }))
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Offene, passende Bedarfe */}
      <section>
        {offene.length === 0 && <p className="text-slate-500">{t('keineBedarfe')}</p>}
        <ul className="flex flex-col gap-3">
          {offene.map((b) => (
            <li key={b.pseudonymId} data-bedarf={b.pseudonymId} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  PG {b.pflegegrad ?? '–'} · {b.qualifikation.join(', ') || '—'} ·{' '}
                  {minToHHMM(b.zeitfenster.von)}–{minToHHMM(b.zeitfenster.bis)} · {b.dauerMin} Min
                </span>
                {b.express && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    Express
                  </span>
                )}
              </div>
              {gesendet[b.pseudonymId] ? (
                <p className="mt-2 font-medium text-green-700">✓ {t('angebotGesendet')}</p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    placeholder={t('nachricht')}
                    value={nachrichten[b.pseudonymId] ?? ''}
                    onChange={(e) =>
                      setNachrichten((n) => ({ ...n, [b.pseudonymId]: e.target.value }))
                    }
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => angebotAbgeben(b.pseudonymId)}
                    disabled={busy}
                    className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {t('angebotAbgeben')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Gewonnene Bedarfe — Kontakt freigegeben */}
      {gewonnen.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">{t('vergeben')}</h2>
          <ul className="flex flex-col gap-3">
            {gewonnen.map((b) => (
              <li key={b.pseudonymId} data-bedarf={b.pseudonymId} className="rounded-lg border border-green-200 bg-green-50 p-4">
                {kontakte[b.pseudonymId] ? (
                  <p className="font-medium text-green-900">{kontakte[b.pseudonymId]}</p>
                ) : (
                  <button
                    onClick={() => kontaktLaden(b.pseudonymId)}
                    className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                  >
                    {t('kontaktAnzeigen')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
