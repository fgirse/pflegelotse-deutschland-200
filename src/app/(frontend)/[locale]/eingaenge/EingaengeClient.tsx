'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { minToHHMM } from '@/shared/time'

interface FitInfo {
  pflegekraftId: string
  mehrwegMin: number
  position: number
}

interface GruppeAuswahl {
  positionen?: string[]
  andere?: string
  beschreibung?: string
  tageProWoche?: number
  malProTag?: number
}
interface OffenerBedarf {
  pseudonymId: string
  pflegegrad?: number
  qualifikation: string[]
  kostentraegerArt?: 'gesetzlich' | 'privat'
  krankenversicherer?: string
  alter?: number
  wohnsituation?: 'alleinlebend' | 'gemeinschaft'
  stadtteil?: string
  startDatum?: string
  abwesenheiten?: string[]
  besonderheiten?: string
  leistungsauswahl?: Record<string, GruppeAuswahl>
  zeitfenster: { von: number; bis: number }
  dauerMin: number
  express: boolean
  status: string
  fit: FitInfo | null
}

// Klartext-Titel je Leistungsgruppe (für die Häufigkeits-Zusammenfassung).
const GRUPPEN_TITEL: Record<string, string> = {
  koerperpflege: 'Körperpflege',
  medizinisch: 'Medizinisch',
  begleitung: 'Begleitung',
  hauswirtschaft: 'Hauswirtschaft',
  beratung: 'Beratung',
}

interface Props {
  tenantId: string
  offene: OffenerBedarf[]
  gewonnen: { pseudonymId: string; uebernommen: boolean }[]
}

// Dienst-Seite: anonyme Bedarfe mit „Angebot abgeben" und gewonnene Bedarfe,
// bei denen der freigegebene Kontakt abrufbar ist.
export function EingaengeClient({ tenantId, offene, gewonnen }: Props) {
  const t = useTranslations('markt')
  const router = useRouter()
  const [nachrichten, setNachrichten] = useState<Record<string, string>>({})
  const [gesendet, setGesendet] = useState<Record<string, boolean>>({})
  const [kontakte, setKontakte] = useState<Record<string, string>>({})
  const [uebernommen, setUebernommen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  async function uebernehmen(bedarfId: string) {
    setBusy(true)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/bedarfe/${bedarfId}/uebernehmen`, { method: 'POST' })
      if (res.ok) {
        setUebernommen((u) => ({ ...u, [bedarfId]: true }))
      } else {
        const d = await res.json().catch(() => null)
        setFehler(d?.error ?? t('uebernehmenFehler'))
      }
    } catch {
      setFehler(t('uebernehmenFehler'))
    } finally {
      setBusy(false)
    }
  }

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
              {/* Kostenträger — für die Abrechnung/Marge des Dienstes wichtig.
                  PKV optisch hervorgehoben (i. d. R. höhere Sätze). */}
              {b.kostentraegerArt && (
                <p className="mt-2 text-sm">
                  <span
                    className={
                      b.kostentraegerArt === 'privat'
                        ? 'chip bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                        : 'chip'
                    }
                  >
                    {t(`kostentraeger.${b.kostentraegerArt}`)}
                  </span>
                  {b.krankenversicherer && (
                    <span className="ml-2 text-[var(--color-muted)]">{b.krankenversicherer}</span>
                  )}
                </p>
              )}

              {/* Neue Angaben aus dem Aufnahmeformular (Person, Zeit, Leistungen). */}
              {(b.alter || b.wohnsituation || b.stadtteil || b.startDatum) && (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  {[
                    b.alter ? `${b.alter} J.` : null,
                    b.wohnsituation === 'alleinlebend' ? 'alleinlebend' : b.wohnsituation === 'gemeinschaft' ? 'in Gemeinschaft' : null,
                    b.stadtteil || null,
                    b.startDatum ? `ab ${new Date(b.startDatum).toLocaleDateString('de-DE')}` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
              {b.leistungsauswahl && Object.keys(b.leistungsauswahl).length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {Object.entries(b.leistungsauswahl).map(([k, v]) => (
                    <li key={k} className="chip text-xs">
                      {GRUPPEN_TITEL[k] ?? k}
                      {v?.tageProWoche ? ` · ${v.tageProWoche}×/Wo` : ''}
                      {v?.malProTag ? ` · ${v.malProTag}×/Tag` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {b.abwesenheiten && b.abwesenheiten.length > 0 && (
                <p className="mt-1 text-xs text-[var(--color-faint)]">
                  Abwesend: {b.abwesenheiten.join(', ')}
                </p>
              )}
              {b.besonderheiten && (
                <p className="mt-1 text-xs text-[var(--color-faint)]">
                  Besonderheiten: {b.besonderheiten}
                </p>
              )}
              {/* Fit-Vorschau: passt der Bedarf in eine Tour? */}
              {b.fit ? (
                <p className="mt-2 text-sm font-medium text-[var(--color-success)]">
                  ✓ {t('fitPasst', {
                    pk: b.fit.pflegekraftId,
                    min: b.fit.mehrwegMin,
                    pos: b.fit.position + 1,
                  })}
                </p>
              ) : (
                <p className="mt-2 text-sm text-[var(--color-faint)]">{t('fitKeinSlot')}</p>
              )}
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
                {/* In die Tourenplanung übernehmen (als Klient). */}
                <div className="mt-3">
                  {b.uebernommen || uebernommen[b.pseudonymId] ? (
                    <p className="text-sm font-medium text-[var(--color-success)]">
                      ✓ {t('uebernommen')}{' '}
                      <Link href="/dashboard" className="text-[var(--color-accent)] hover:underline">
                        {t('zumDashboard')}
                      </Link>
                    </p>
                  ) : (
                    <button
                      onClick={() => uebernehmen(b.pseudonymId)}
                      disabled={busy}
                      className="btn btn-outline"
                    >
                      {t('inTourplanung')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
