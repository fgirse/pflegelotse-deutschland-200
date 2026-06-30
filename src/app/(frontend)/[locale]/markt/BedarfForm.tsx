'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { hhmmToMin } from '@/shared/time'
import { ORTE } from '@/shared/orte'
import { kassenFuerArt, type KostentraegerArt } from '@/shared/krankenkassen'
import {
  BUNDESLAENDER,
  leistungenFuerBundesland,
  istVorlaeufigerKatalog,
  type Bundesland,
} from '@/shared/leistungskomplexe'

// Zweistufiges Bedarfsformular. Schritt 1: Pflegesituation (operative Daten),
// Schritt 2: Kontakt (PII). Beim Absenden POST /api/v1/bedarfe.
export function BedarfForm() {
  const t = useTranslations('markt')
  const router = useRouter()
  const [schritt, setSchritt] = useState<1 | 2>(1)
  const [fehler, setFehler] = useState<string | null>(null)
  const [sende, setSende] = useState(false)

  // Schritt 1
  const [ort, setOrt] = useState<keyof typeof ORTE>('Wiehre')
  // Optionales Geocoding: freie Adresse/Ort → Koordinaten (überschreibt die
  // Auswahl aus der Ortsliste, wenn ein Treffer gefunden wurde).
  const [adresseSuche, setAdresseSuche] = useState('')
  const [geocodedGeo, setGeocodedGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLabel, setGeoLabel] = useState<string | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [pflegegrad, setPflegegrad] = useState(3)
  const [qualifikation, setQualifikation] = useState('grundpflege')
  // Bundesland steuert den anzuwendenden Leistungskatalog (Pilot: BW).
  const [bundesland, setBundesland] = useState<Bundesland>('Baden-Württemberg')
  const [leistungen, setLeistungen] = useState<string[]>(['LK01'])
  // Kostenträger: Art (gesetzlich/privat) + konkrete Kasse. Beides optional.
  const [kvArt, setKvArt] = useState<'' | KostentraegerArt>('')
  const [kasse, setKasse] = useState('')
  const [von, setVon] = useState('08:30')
  const [bis, setBis] = useState('10:00')
  const [dauer, setDauer] = useState(30)
  const [express, setExpress] = useState(false)

  // Schritt 2
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [telefon, setTelefon] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [einw, setEinw] = useState(false)

  // Übernimmt einen vom KI-Lotsen vorgeschlagenen Entwurf (via sessionStorage).
  useEffect(() => {
    const roh = sessionStorage.getItem('bedarfEntwurf')
    if (!roh) return
    sessionStorage.removeItem('bedarfEntwurf')
    try {
      const e = JSON.parse(roh)
      if (e.ort && e.ort in ORTE) setOrt(e.ort as keyof typeof ORTE)
      if (typeof e.pflegegrad === 'number') setPflegegrad(e.pflegegrad)
      if (Array.isArray(e.qualifikation) && e.qualifikation[0]) setQualifikation(e.qualifikation[0])
      if (Array.isArray(e.leistungen) && e.leistungen.length) setLeistungen(e.leistungen.map(String))
      if (e.zeitVon) setVon(e.zeitVon)
      if (e.zeitBis) setBis(e.zeitBis)
      if (typeof e.dauerMin === 'number') setDauer(e.dauerMin)
      if (typeof e.express === 'boolean') setExpress(e.express)
    } catch {
      /* ungültiger Entwurf — ignorieren */
    }
  }, [])

  // Geocodiert die freie Adresse und merkt sich die Koordinaten.
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
    setSende(true)
    setFehler(null)
    try {
      const res = await fetch('/api/v1/bedarfe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // Geocodierte Adresse hat Vorrang, sonst der gewählte Ort.
          geo: geocodedGeo ?? ORTE[ort],
          pflegegrad,
          qualifikation: [qualifikation],
          leistungen,
          kostentraegerArt: kvArt || undefined,
          krankenversicherer: kasse || undefined,
          zeitfenster: { von: hhmmToMin(von), bis: hhmmToMin(bis) },
          dauerMin: dauer,
          express,
          kontakt: { vorname, nachname, telefon, email, adresse },
          einwilligung: einw,
        }),
      })
      if (!res.ok) throw new Error('Fehler beim Einstellen')
      const data = await res.json()
      router.push(`/markt/${data.bedarfId}`)
    } catch (e) {
      setFehler((e as Error).message)
      setSende(false)
    }
  }

  const inputCls = 'input'

  return (
    <div className="card mt-6 p-5 sm:p-6">
      <p className="mb-5 rounded-lg bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-accent)]">{t('hinweisAnonym')}</p>

      {schritt === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">{t('step1')}</h2>
          <label className="label">
            {t('ort')}
            <select value={ort} onChange={(e) => setOrt(e.target.value as keyof typeof ORTE)} className={inputCls}>
              {Object.keys(ORTE).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          {/* Optional: freie Adresse/Ort per Geocoding (überschreibt die Auswahl). */}
          <div>
            <span className="label">{t('adresseSuche')}</span>
            <div className="mt-1 flex gap-2">
              <input
                value={adresseSuche}
                onChange={(e) => setAdresseSuche(e.target.value)}
                placeholder={t('adresseSuchePlatzhalter')}
                className={inputCls}
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
          </div>
          <label className="label">
            {t('pflegegrad')}
            <select value={pflegegrad} onChange={(e) => setPflegegrad(Number(e.target.value))} className={inputCls}>
              {[1, 2, 3, 4, 5].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="label">
            {t('qualifikation')}
            <select value={qualifikation} onChange={(e) => setQualifikation(e.target.value)} className={inputCls}>
              <option value="grundpflege">{t('grundpflege')}</option>
              <option value="behandlungspflege">{t('behandlungspflege')}</option>
            </select>
          </label>
          {/* Bundesland steuert den Leistungskatalog (Codes je Land verschieden). */}
          <label className="label">
            {t('bundesland')}
            <select
              value={bundesland}
              onChange={(e) => {
                const bl = e.target.value as Bundesland
                setBundesland(bl)
                // Vorauswahl auf Codes beschränken, die es im neuen Katalog gibt.
                const codes = leistungenFuerBundesland(bl).map((l) => l.code)
                setLeistungen((prev) => prev.filter((c) => codes.includes(c)))
              }}
              className={inputCls}
            >
              {BUNDESLAENDER.map((bl) => (
                <option key={bl} value={bl}>{bl}</option>
              ))}
            </select>
          </label>

          {/* Leistungen als Auswahl-Liste (Checkboxen) mit Klartext statt
              kryptischer Code-Eingabe — für Angehörige verständlich. */}
          <fieldset>
            <legend className="text-sm font-medium text-[var(--color-ink)]">{t('leistungen')}</legend>
            {istVorlaeufigerKatalog(bundesland) && (
              <p className="mt-1 text-xs text-[var(--color-faint)]">{t('leistungenVorlaeufig')}</p>
            )}
            <div className="mt-2 flex flex-col gap-3 rounded-lg border border-[var(--color-line)] p-3">
              {(['grundpflege', 'behandlungspflege'] as const).map((q) => (
                <div key={q}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-faint)]">
                    {t(q)}
                  </p>
                  <div className="flex flex-col">
                    {leistungenFuerBundesland(bundesland)
                      .filter((l) => l.qualifikation === q)
                      .map((l) => (
                      <label
                        key={l.code}
                        className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--color-ink)]"
                      >
                        <input
                          type="checkbox"
                          checked={leistungen.includes(l.code)}
                          onChange={() =>
                            setLeistungen((prev) =>
                              prev.includes(l.code)
                                ? prev.filter((c) => c !== l.code)
                                : [...prev, l.code],
                            )
                          }
                          className="h-5 w-5 shrink-0 accent-[var(--color-accent-strong)]"
                        />
                        <span>
                          <span className="font-medium">{l.code}</span> · {l.bezeichnung}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
          {/* Kostenträger: Art wählen, dann (optional) die konkrete Kasse. */}
          <label className="label">
            {t('kostentraegerArt')}
            <select
              value={kvArt}
              onChange={(e) => {
                setKvArt(e.target.value as '' | KostentraegerArt)
                setKasse('') // Kasse zurücksetzen, wenn die Art wechselt
              }}
              className={inputCls}
            >
              <option value="">{t('kostentraegerKeineAngabe')}</option>
              <option value="gesetzlich">{t('kostentraegerGesetzlich')}</option>
              <option value="privat">{t('kostentraegerPrivat')}</option>
            </select>
          </label>
          {kvArt && (
            <label className="label">
              {t('krankenversicherer')}
              <select value={kasse} onChange={(e) => setKasse(e.target.value)} className={inputCls}>
                <option value="">{t('krankenversichererWaehlen')}</option>
                {kassenFuerArt(kvArt).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
          )}
          <div className="flex gap-3">
            <label className="label flex-1">
              {t('zeitVon')}
              <input type="time" value={von} onChange={(e) => setVon(e.target.value)} className={inputCls} />
            </label>
            <label className="label flex-1">
              {t('zeitBis')}
              <input type="time" value={bis} onChange={(e) => setBis(e.target.value)} className={inputCls} />
            </label>
            <label className="label w-28">
              {t('dauer')}
              <input type="number" value={dauer} onChange={(e) => setDauer(Number(e.target.value))} className={inputCls} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent-strong)]" />
            {t('express')}
          </label>
          <button onClick={() => setSchritt(2)} className="btn btn-primary">
            {t('weiter')}
          </button>
        </div>
      )}

      {schritt === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">{t('step2')}</h2>
          <label className="label">{t('vorname')}
            <input value={vorname} onChange={(e) => setVorname(e.target.value)} className={inputCls} />
          </label>
          <label className="label">{t('nachname')}
            <input value={nachname} onChange={(e) => setNachname(e.target.value)} className={inputCls} />
          </label>
          <label className="label">{t('telefon')}
            <input value={telefon} onChange={(e) => setTelefon(e.target.value)} className={inputCls} />
          </label>
          <label className="label">{t('email')}
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="label">{t('adresse')}
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={inputCls} />
          </label>
          {/* Pflicht-Einwilligung (Art. 9 DSGVO) mit Verweis auf die Datenschutzerklärung. */}
          <label className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={einw}
              onChange={(e) => setEinw(e.target.checked)}
              className="mt-1"
            />
            <span>
              {t('einwilligungLabel')}{' '}
              <Link href="/datenschutz" className="text-[var(--color-accent)] hover:underline">
                {t('datenschutzLink')}
              </Link>
            </span>
          </label>
          {fehler && <p className="text-sm text-[var(--color-danger)]">⚠ {fehler}</p>}
          <div className="flex gap-3">
            <button onClick={() => setSchritt(1)} className="btn btn-outline">{t('zurueck')}</button>
            <button
              onClick={absenden}
              disabled={sende || !vorname || !nachname || !telefon || !einw}
              className="btn btn-accent flex-1"
            >
              {t('absenden')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
