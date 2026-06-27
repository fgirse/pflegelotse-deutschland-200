'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { minToHHMM } from '@/shared/time'

export interface PortalEintrag {
  pseudonymId: string
  status: string
  express: boolean
  pflegegrad?: number
  zeitfensterVon: number
  zeitfensterBis: number
  dauerMin: number
  qualifikation: string[]
  leistungen: string[]
  anzahlAngebote: number
  eingestellt?: string
  ersteReaktion?: string
  frist?: string
}

export function MeineBedarfeListe({ eintraege }: { eintraege: PortalEintrag[] }) {
  const t = useTranslations('meineBedarfe')
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  async function zurueckziehen(id: string) {
    if (!window.confirm(t('zurueckziehenBestaetigen'))) return
    setBusy(id)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/bedarfe/${id}/zurueckziehen`, { method: 'POST' })
      if (res.ok) router.refresh()
      else {
        const d = await res.json().catch(() => null)
        setFehler(d?.error ?? t('aktionFehler'))
      }
    } catch {
      setFehler(t('aktionFehler'))
    } finally {
      setBusy(null)
    }
  }

  // Operative Felder ins Bedarfsformular übernehmen und dorthin wechseln.
  function erneutEinstellen(e: PortalEintrag) {
    sessionStorage.setItem(
      'bedarfEntwurf',
      JSON.stringify({
        pflegegrad: e.pflegegrad,
        qualifikation: e.qualifikation,
        leistungen: e.leistungen,
        zeitVon: minToHHMM(e.zeitfensterVon),
        zeitBis: minToHHMM(e.zeitfensterBis),
        dauerMin: e.dauerMin,
        express: e.express,
      }),
    )
    router.push('/markt')
  }

  const offen = (s: string) => s === 'offen' || s === 'in_bearbeitung'

  return (
    <>
      {fehler && <p className="mt-3 text-sm text-[var(--color-danger)]">⚠ {fehler}</p>}
      <ul className="mt-6 flex flex-col gap-4">
        {eintraege.map((e) => (
          <li key={e.pseudonymId} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip">{t(`status.${e.status}`)}</span>
              {e.express && <span className="chip">Express</span>}
            </div>

            <div className="mt-3 text-sm text-[var(--color-muted)]">
              {e.pflegegrad ? `${t('pflegegrad')} ${e.pflegegrad} · ` : ''}
              {minToHHMM(e.zeitfensterVon)}–{minToHHMM(e.zeitfensterBis)} · {e.dauerMin} {t('min')}
            </div>

            {/* Status-Verlauf */}
            <ul className="mt-3 flex flex-col gap-0.5 text-xs text-[var(--color-faint)]">
              {e.eingestellt && <li>• {t('eingestellt')}: {e.eingestellt}</li>}
              {e.ersteReaktion && <li>• {t('ersteReaktion')}: {e.ersteReaktion}</li>}
              {offen(e.status) && e.frist && <li>• {t('frist')}: {e.frist}</li>}
            </ul>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">{t('angebote', { n: e.anzahlAngebote })}</span>
              <div className="flex flex-wrap gap-2">
                <Link href={`/meine-bedarfe/${e.pseudonymId}`} className="btn btn-outline">
                  {t('ansehenWaehlen')}
                </Link>
                {offen(e.status) ? (
                  <button
                    onClick={() => zurueckziehen(e.pseudonymId)}
                    disabled={busy === e.pseudonymId}
                    className="btn btn-outline"
                  >
                    {t('zurueckziehen')}
                  </button>
                ) : (
                  <button onClick={() => erneutEinstellen(e)} className="btn btn-primary">
                    {t('erneutEinstellen')}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
