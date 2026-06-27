'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

// Unsere Zielfelder. label = Anzeige, req = Pflicht. Geo wird aus adresse/ort
// geokodiert, falls lat/lng nicht zugeordnet sind.
const FELDER: { key: string; label: string; req?: boolean }[] = [
  { key: 'external_id', label: 'Eindeutige Kennung (Pflicht)', req: true },
  { key: 'vorname', label: 'Vorname' },
  { key: 'nachname', label: 'Nachname' },
  { key: 'adresse', label: 'Adresse (Straße)' },
  { key: 'ort', label: 'Ort / PLZ' },
  { key: 'telefon', label: 'Telefon' },
  { key: 'email', label: 'E-Mail' },
  { key: 'pflegegrad', label: 'Pflegegrad' },
  { key: 'leistungen', label: 'Leistungen (Trenner ; oder ,)' },
  { key: 'qualifikation', label: 'Qualifikation' },
  { key: 'zeitfenster_von', label: 'Einsatz von (HH:MM)' },
  { key: 'zeitfenster_bis', label: 'Einsatz bis (HH:MM)' },
  { key: 'dauer', label: 'Dauer (Min)' },
  { key: 'lat', label: 'Breitengrad (optional)' },
  { key: 'lng', label: 'Längengrad (optional)' },
]

const SYNONYME: Record<string, string[]> = {
  external_id: ['externalid', 'id', 'kundennr', 'kundennummer', 'klientnr', 'klientennr', 'nummer'],
  vorname: ['vorname', 'firstname', 'given'],
  nachname: ['nachname', 'name', 'lastname', 'surname', 'familienname'],
  adresse: ['adresse', 'strasse', 'straße', 'street', 'anschrift'],
  ort: ['ort', 'plz', 'stadt', 'city', 'postleitzahl'],
  telefon: ['telefon', 'tel', 'phone', 'rufnummer'],
  email: ['email', 'mail'],
  pflegegrad: ['pflegegrad', 'grad'],
  leistungen: ['leistungen', 'leistung', 'leistungskomplex'],
  qualifikation: ['qualifikation', 'qual'],
  zeitfenster_von: ['von', 'beginn', 'start'],
  zeitfenster_bis: ['bis', 'ende', 'end'],
  dauer: ['dauer', 'duration', 'minuten'],
  lat: ['lat', 'breite', 'latitude'],
  lng: ['lng', 'lon', 'laenge', 'länge', 'longitude'],
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

type Ergebnis = {
  neu: number
  aktualisiert: number
  verarbeitet: number
  fehler: { externalId: string; grund: string }[]
}

export function ImportClient() {
  const t = useTranslations('import')
  const [csv, setCsv] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [anzahl, setAnzahl] = useState(0)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)

  async function dateiGewaehlt(file: File) {
    setFehler(null)
    setErgebnis(null)
    const text = await file.text()
    setCsv(text)
    const res = await fetch('/api/v1/import/preview', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: text,
    })
    if (!res.ok) {
      setFehler(t('fehlerDatei'))
      return
    }
    const d = await res.json()
    setHeaders(d.headers ?? [])
    setAnzahl(d.anzahl ?? 0)
    // Automatische Zuordnung per Synonym-Treffer.
    const auto: Record<string, string> = {}
    for (const f of FELDER) {
      const treffer = (d.headers as string[]).find((h) => {
        const n = norm(h)
        return n === f.key || (SYNONYME[f.key] ?? []).some((syn) => n.includes(syn))
      })
      if (treffer) auto[f.key] = treffer
    }
    setMapping(auto)
  }

  async function importieren() {
    setBusy(true)
    setFehler(null)
    try {
      const res = await fetch('/api/v1/import/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csv, mapping }),
      })
      if (!res.ok) {
        setFehler(t('fehlerImport'))
        return
      }
      setErgebnis(await res.json())
    } catch {
      setFehler(t('fehlerImport'))
    } finally {
      setBusy(false)
    }
  }

  const geoOk = Boolean(mapping.adresse || (mapping.lat && mapping.lng))
  const bereit = Boolean(mapping.external_id) && geoOk

  return (
    <div className="mt-6 flex flex-col gap-5">
      {/* Datei wählen */}
      <div className="card p-5">
        <span className="label">{t('datei')}</span>
        <input
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={(e) => e.target.files?.[0] && dateiGewaehlt(e.target.files[0])}
          className="mt-2 block w-full text-sm"
        />
        <p className="mt-2 text-xs text-[var(--color-faint)]">{t('dateiHinweis')}</p>
        {headers.length > 0 && (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {t('erkannt', { spalten: headers.length, zeilen: anzahl })}
          </p>
        )}
      </div>

      {fehler && <p className="text-sm text-[var(--color-danger)]">⚠ {fehler}</p>}

      {/* Spaltenzuordnung */}
      {headers.length > 0 && !ergebnis && (
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold">{t('zuordnung')}</h2>
          <p className="mt-1 text-xs text-[var(--color-faint)]">{t('zuordnungHinweis')}</p>
          <div className="mt-3 flex flex-col gap-2">
            {FELDER.map((f) => (
              <label key={f.key} className="grid grid-cols-2 items-center gap-2 text-sm">
                <span className={f.req ? 'font-medium' : ''}>{f.label}</span>
                <select
                  className="input mt-0"
                  value={mapping[f.key] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                >
                  <option value="">— {t('nichtZuordnen')} —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {!geoOk && <p className="mt-3 text-sm text-[var(--color-danger)]">⚠ {t('geoNoetig')}</p>}
          <button
            onClick={importieren}
            disabled={busy || !bereit}
            className="btn btn-accent mt-4"
          >
            {busy ? t('importiereLaedt') : t('importieren', { n: anzahl })}
          </button>
        </div>
      )}

      {/* Ergebnis */}
      {ergebnis && (
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold text-[var(--color-success)]">
            ✓ {t('fertig')}
          </h2>
          <p className="mt-2 text-sm">
            {t('ergebnis', { neu: ergebnis.neu, aktualisiert: ergebnis.aktualisiert })}
          </p>
          {ergebnis.fehler.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-[var(--color-danger)]">
                {t('fehlerTitel', { n: ergebnis.fehler.length })}
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs text-[var(--color-muted)]">
                {ergebnis.fehler.slice(0, 20).map((f, i) => (
                  <li key={i}>
                    {f.externalId}: {f.grund}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
