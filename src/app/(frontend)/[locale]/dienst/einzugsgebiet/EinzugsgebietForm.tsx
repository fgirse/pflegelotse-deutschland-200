'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ORTE } from '@/shared/orte'

// Formular zum Festlegen des Einzugsgebiets eines Dienstes: Mittelpunkt (über
// die bekannten Orte der Pilotregion) + Radius in km. Bedarfe im Umkreis
// erscheinen dann unter „Eingänge" — auch ohne bestehende Tour.
export function EinzugsgebietForm() {
  const t = useTranslations('einzugsgebiet')
  const [ort, setOrt] = useState<string>(Object.keys(ORTE)[0])
  const [radius, setRadius] = useState(15)
  const [gesetzt, setGesetzt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  // Optionales Geocoding für einen Mittelpunkt außerhalb der Ortsliste.
  const [adresseSuche, setAdresseSuche] = useState('')
  const [geocodedGeo, setGeocodedGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLabel, setGeoLabel] = useState<string | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)

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

  useEffect(() => {
    fetch('/api/v1/dienst/einzugsgebiet')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.radiusKm === 'number') {
          setRadius(d.radiusKm)
          setGesetzt(true)
        }
      })
      .catch(() => {})
  }, [])

  async function speichern() {
    setBusy(true)
    setOk(false)
    // Geocodierter Mittelpunkt hat Vorrang, sonst der gewählte Ort.
    const geo = geocodedGeo ?? ORTE[ort]
    const res = await fetch('/api/v1/dienst/einzugsgebiet', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lat: geo.lat, lng: geo.lng, radiusKm: radius }),
    })
    setBusy(false)
    if (res.ok) {
      setOk(true)
      setGesetzt(true)
    }
  }

  return (
    <div className="card mt-6 p-5">
      {gesetzt && !ok && (
        <p className="mb-3 text-sm text-[var(--color-muted)]">{t('aktuellGesetzt')}</p>
      )}
      {ok && (
        <p className="mb-3 rounded-lg bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-accent)]">
          {t('gespeichert')}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <label className="label">
          {t('ort')}
          <select className="input" value={ort} onChange={(e) => setOrt(e.target.value)}>
            {Object.keys(ORTE).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        {/* Optional: freie Adresse/Ort per Geocoding. */}
        <div>
          <span className="label">{t('adresseSuche')}</span>
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
        </div>
        <label className="label">
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
        <button onClick={speichern} disabled={busy} className="btn btn-primary mt-1">
          {t('speichern')}
        </button>
      </div>
    </div>
  )
}
