'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ORTE } from '@/shared/orte'

type Typ = 'suchende' | 'dienst'

// Selbstregistrierung für beide Zielgruppen. Rolle/Mandant setzt der Server;
// hier nur die fachlichen Felder. Nach Erfolg geht es zur Anmeldung (Dienste
// richten dort 2FA ein, Suchende landen direkt im Marktplatz).
export function RegistrierenForm({ locale }: { locale: string }) {
  const t = useTranslations('registrieren')
  const [typ, setTyp] = useState<Typ>('suchende')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [suchendeTyp, setSuchendeTyp] = useState('angehoerige')
  const [dienstName, setDienstName] = useState('')
  // Einzugsgebiet des Dienstes: Ortsauswahl (Fallback) + optionale Adresssuche.
  const [ortWahl, setOrtWahl] = useState<string>(Object.keys(ORTE)[0])
  const [radius, setRadius] = useState(15)
  const [adresseSuche, setAdresseSuche] = useState('')
  const [geocodedGeo, setGeocodedGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLabel, setGeoLabel] = useState<string | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [einw, setEinw] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function adresseSuchen() {
    if (adresseSuche.trim().length < 3) return
    setGeoBusy(true)
    setGeoLabel(null)
    try {
      const res = await fetch(`/api/v1/geo/geocode?q=${encodeURIComponent(adresseSuche)}`)
      if (!res.ok) {
        setGeocodedGeo(null)
        setGeoLabel(t('ortNichtGefunden'))
        return
      }
      const d = await res.json()
      setGeocodedGeo({ lat: d.lat, lng: d.lng })
      setGeoLabel(d.displayName)
    } catch {
      setGeocodedGeo(null)
      setGeoLabel(t('ortNichtGefunden'))
    } finally {
      setGeoBusy(false)
    }
  }

  async function absenden() {
    setBusy(true)
    setFehler(null)
    try {
      const einzugsGeo = geocodedGeo ?? ORTE[ortWahl]
      const body =
        typ === 'dienst'
          ? { typ, email, password, dienstName, einzugsGeo, einzugsRadiusKm: radius, einwilligung: einw }
          : { typ, email, password, suchendeTyp, einwilligung: einw }
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 409) {
        setFehler(t('fehlerEmailExists'))
        return
      }
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      // Zur Anmeldung mit vorbelegter E-Mail und Erfolgshinweis.
      window.location.href = `/${locale}/login?registriert=1&email=${encodeURIComponent(email)}`
    } finally {
      setBusy(false)
    }
  }

  const tabCls = (aktiv: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      aktiv
        ? 'bg-[var(--color-ink)] text-white'
        : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-line)]'
    }`

  const bereit =
    email.length > 3 &&
    password.length >= 8 &&
    einw &&
    (typ === 'suchende' || dienstName.length >= 2)

  return (
    <div className="card mt-6 p-5">
      {/* Zielgruppen-Umschalter */}
      <div className="flex gap-2" role="tablist" aria-label={t('typLabel')}>
        <button type="button" className={tabCls(typ === 'suchende')} onClick={() => setTyp('suchende')}>
          {t('typSuchende')}
        </button>
        <button type="button" className={tabCls(typ === 'dienst')} onClick={() => setTyp('dienst')}>
          {t('typDienst')}
        </button>
      </div>

      <p className="mt-3 text-sm text-[var(--color-muted)]">
        {typ === 'dienst' ? t('hinweisDienst') : t('hinweisSuchende')}
      </p>

      {fehler && <p className="mt-3 text-sm text-[var(--color-danger)]">⚠ {fehler}</p>}

      <div className="mt-4 flex flex-col gap-3">
        {typ === 'suchende' && (
          <label className="label">
            {t('suchendeTypLabel')}
            <select
              className="input"
              value={suchendeTyp}
              onChange={(e) => setSuchendeTyp(e.target.value)}
            >
              <option value="angehoerige">{t('suchendeAngehoerige')}</option>
              <option value="patient">{t('suchendePatient')}</option>
              <option value="sozialdienst">{t('suchendeSozialdienst')}</option>
            </select>
          </label>
        )}

        {typ === 'dienst' && (
          <>
            <label className="label">
              {t('dienstName')}
              <input className="input" value={dienstName} onChange={(e) => setDienstName(e.target.value)} />
            </label>

            {/* Einzugsgebiet: Mittelpunkt + Radius — damit der Dienst sofort
                passende Bedarfe sieht. */}
            <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
              <p className="text-sm font-medium">{t('einzugsTitel')}</p>
              <p className="mt-1 text-xs text-[var(--color-faint)]">{t('einzugsHinweis')}</p>
              <label className="label mt-3">
                {t('ort')}
                <select className="input" value={ortWahl} onChange={(e) => setOrtWahl(e.target.value)}>
                  {Object.keys(ORTE).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <span className="label mt-3">{t('adresseSuche')}</span>
              <div className="mt-1 flex gap-2">
                <input
                  value={adresseSuche}
                  onChange={(e) => setAdresseSuche(e.target.value)}
                  placeholder={t('adresseSuchePlatzhalter')}
                  className="input"
                />
                <button
                  type="button"
                  onClick={adresseSuchen}
                  disabled={geoBusy || adresseSuche.trim().length < 3}
                  className="btn btn-outline shrink-0"
                >
                  {t('suchen')}
                </button>
              </div>
              {geoLabel && (
                <p className="mt-1 text-xs text-[var(--color-faint)]">
                  {geocodedGeo ? `✓ ${geoLabel}` : geoLabel}
                </p>
              )}
              <label className="label mt-3">
                {t('radius')}
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                />
              </label>
            </div>
          </>
        )}

        <label className="label">
          {t('email')}
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="label">
          {t('password')}
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {/* Pflicht-Einwilligung mit Verweis auf die Datenschutzerklärung. */}
        <label className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
          <input type="checkbox" checked={einw} onChange={(e) => setEinw(e.target.checked)} className="mt-1" />
          <span>
            {t('einwilligungLabel')}{' '}
            <Link href="/datenschutz" className="text-[var(--color-accent)] hover:underline">
              {t('datenschutzLink')}
            </Link>
          </span>
        </label>

        <button onClick={absenden} disabled={busy || !bereit} className="btn btn-accent mt-1">
          {t('absenden')}
        </button>
      </div>
    </div>
  )
}
