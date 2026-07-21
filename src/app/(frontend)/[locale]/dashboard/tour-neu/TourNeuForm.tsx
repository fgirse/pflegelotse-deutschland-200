'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

// Heutiges Datum als YYYY-MM-DD (lokale Zeit) — Vorbelegung des Datumsfelds.
function heuteISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// "HH:MM" → Minuten seit Mitternacht; null bei ungültiger Eingabe.
function hhmmZuMin(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

// Formular zum Anlegen einer neuen Tour. Der Startpunkt (Depot) wird über eine
// freie Adresse per Geocoding in Koordinaten aufgelöst. Nach dem Speichern
// zurück aufs Dashboard, wo die Tour sofort erscheint.
export function TourNeuForm() {
  const t = useTranslations('tourNeu')
  const router = useRouter()

  const [datum, setDatum] = useState(heuteISO())
  const [pflegekraftId, setPflegekraftId] = useState('')
  const [qualifikation, setQualifikation] = useState('')
  const [startZeit, setStartZeit] = useState('08:00')

  // Adresse → Koordinaten (Depot).
  const [adresse, setAdresse] = useState('')
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLabel, setGeoLabel] = useState<string | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)

  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  async function adresseSuchen() {
    if (adresse.trim().length < 3) return
    setGeoBusy(true)
    setGeoLabel(null)
    setGeo(null)
    try {
      const res = await fetch(`/api/v1/geo/geocode?q=${encodeURIComponent(adresse)}`)
      if (!res.ok) {
        setGeoLabel(t('adresseNichtGefunden'))
        return
      }
      const d = await res.json()
      setGeo({ lat: d.lat, lng: d.lng })
      setGeoLabel(d.displayName)
    } catch {
      setGeoLabel(t('adresseNichtGefunden'))
    } finally {
      setGeoBusy(false)
    }
  }

  async function speichern() {
    setFehler(null)
    if (!datum || !pflegekraftId.trim()) {
      setFehler(t('fehlerPflicht'))
      return
    }
    if (!geo) {
      setFehler(t('fehlerAdresse'))
      return
    }
    const min = hhmmZuMin(startZeit)
    if (min === null) {
      setFehler(t('fehlerZeit'))
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/v1/tours', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          datum,
          pflegekraftId: pflegekraftId.trim(),
          // Kommagetrennte Qualifikationen → Array (leere Einträge verwerfen).
          pflegekraftQualifikation: qualifikation
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          start: geo,
          startZeit: min,
        }),
      })
      if (!res.ok) {
        setFehler(t('fehlerSpeichern'))
        setBusy(false)
        return
      }
      // Zurück aufs Dashboard; refresh lädt die Server-Daten neu.
      router.push('/dashboard')
      router.refresh()
    } catch {
      setFehler(t('fehlerSpeichern'))
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      {fehler && <p className="mb-3 text-sm text-[var(--color-danger)]">⚠ {fehler}</p>}
      <div className="flex flex-col gap-3">
        <label className="label">
          {t('datum')}
          <input className="input" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </label>

        <label className="label">
          {t('pflegekraft')}
          <input
            className="input"
            value={pflegekraftId}
            onChange={(e) => setPflegekraftId(e.target.value)}
            placeholder={t('pflegekraftPlatzhalter')}
          />
        </label>

        <label className="label">
          {t('qualifikation')}
          <input
            className="input"
            value={qualifikation}
            onChange={(e) => setQualifikation(e.target.value)}
            placeholder={t('qualifikationPlatzhalter')}
          />
        </label>

        <label className="label">
          {t('startZeit')}
          <input className="input" type="time" value={startZeit} onChange={(e) => setStartZeit(e.target.value)} />
        </label>

        {/* Depot/Startpunkt über freie Adresse (Geocoding). */}
        <div>
          <span className="label">{t('startAdresse')}</span>
          <div className="mt-1 flex gap-2">
            <input
              className="input"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder={t('startAdressePlatzhalter')}
            />
            <button
              type="button"
              onClick={adresseSuchen}
              disabled={geoBusy || adresse.trim().length < 3}
              className="btn btn-outline shrink-0"
            >
              {t('suchen')}
            </button>
          </div>
          {geoLabel && (
            <p className="mt-1 text-xs text-[var(--color-faint)]">
              {geo ? `✓ ${geoLabel}` : geoLabel}
            </p>
          )}
        </div>

        <button onClick={speichern} disabled={busy} className="btn btn-primary mt-1">
          {busy ? t('speichert') : t('speichern')}
        </button>
      </div>
    </div>
  )
}
