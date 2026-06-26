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
  const [fehler, setFehler] = useState<string | null>(null)

  async function angebotAbgeben(bedarfId: string) {
    setBusy(true)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/bedarfe/${bedarfId}/angebote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, nachricht: nachrichten[bedarfId] ?? '' }),
      })
      if (res.ok) {
        setGesendet((g) => ({ ...g, [bedarfId]: true }))
        router.refresh()
      } else {
        // Fehler nicht verschlucken — Meldung aus der Antwort zeigen.
        const d = await res.json().catch(() => null)
        setFehler(d?.error ?? t('angebotFehler'))
      }
    } catch {
      setFehler(t('angebotFehler'))
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
      {fehler && <p className="text-sm text-[var(--color-danger)]">⚠ {fehler}</p>}
      {/* Offene, passende Bedarfe */}
      <section>
        {offene.length === 0 && <p className="text-[var(--color-faint)]">{t('keineBedarfe')}</p>}
        <ul className="flex flex-col gap-3">
          {offene.map((b) => (
            <li key={b.pseudonymId} data-bedarf={b.pseudonymId} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  PG {b.pflegegrad ?? '–'} · {b.qualifikation.join(', ') || '—'} ·{' '}
                  {minToHHMM(b.zeitfenster.von)}–{minToHHMM(b.zeitfenster.bis)} · {b.dauerMin} Min
                </span>
                {b.express && <span className="chip">Express</span>}
              </div>
              {gesendet[b.pseudonymId] ? (
                <p className="mt-2 font-medium text-[var(--color-success)]">✓ {t('angebotGesendet')}</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    placeholder={t('nachricht')}
                    value={nachrichten[b.pseudonymId] ?? ''}
                    onChange={(e) =>
                      setNachrichten((n) => ({ ...n, [b.pseudonymId]: e.target.value }))
                    }
                    className="input mt-0 flex-1"
                  />
                  <button
                    onClick={() => angebotAbgeben(b.pseudonymId)}
                    disabled={busy}
                    className="btn btn-accent"
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
              <li
                key={b.pseudonymId}
                data-bedarf={b.pseudonymId}
                className="card border-l-4 border-l-[var(--color-success)] p-4"
              >
                {kontakte[b.pseudonymId] ? (
                  <p className="font-medium text-[var(--color-success)]">{kontakte[b.pseudonymId]}</p>
                ) : (
                  <button onClick={() => kontaktLaden(b.pseudonymId)} className="btn btn-primary">
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
