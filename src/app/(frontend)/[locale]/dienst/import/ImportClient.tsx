'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ZIELFELDER, rateMapping } from '@/shared/importMapping'

type Ergebnis = {
  neu: number
  aktualisiert: number
  verarbeitet: number
  fehler: { externalId: string; grund: string }[]
}

export function ImportClient({ initialText }: { initialText?: string } = {}) {
  const t = useTranslations('import')
  const [csv, setCsv] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [anzahl, setAnzahl] = useState(0)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)
  const [fortschritt, setFortschritt] = useState<{ fertig: number; gesamt: number } | null>(null)

  async function verarbeiteText(text: string) {
    setFehler(null)
    setErgebnis(null)
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
    // Automatische Spaltenzuordnung (auf deutsche Pflegesoftware getrimmt).
    setMapping(rateMapping(d.headers ?? []))
  }

  async function dateiGewaehlt(file: File) {
    await verarbeiteText(await file.text())
  }

  // Vom Dashboard-Upload übergebene Datei beim Öffnen automatisch verarbeiten.
  useEffect(() => {
    if (initialText) verarbeiteText(initialText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText])

  // Import in Blöcken (Client-Chunking): große Dateien würden in EINEM Request
  // das Serverless-Timeout reißen. Wir senden je BLOCK Zeilen nacheinander,
  // aggregieren die Ergebnisse und zeigen den Fortschritt. Header wird jedem
  // Block vorangestellt (zeilenbasiert — behält die Originalformatierung).
  const BLOCK = 40
  async function importieren() {
    setBusy(true)
    setFehler(null)
    setErgebnis(null)
    const zeilen = csv.split(/\r?\n/)
    const header = zeilen[0] ?? ''
    const daten = zeilen.slice(1).filter((z) => z.trim() !== '')
    const gesamt = daten.length
    setFortschritt({ fertig: 0, gesamt })

    let neu = 0
    let aktualisiert = 0
    let verarbeitet = 0
    const alleFehler: Ergebnis['fehler'] = []
    try {
      for (let i = 0; i < daten.length; i += BLOCK) {
        const block = daten.slice(i, i + BLOCK)
        const blockCsv = `${header}\n${block.join('\n')}\n`
        try {
          const res = await fetch('/api/v1/import/clients', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ csv: blockCsv, mapping }),
          })
          if (res.ok) {
            const d = (await res.json()) as Ergebnis
            neu += d.neu
            aktualisiert += d.aktualisiert
            verarbeitet += d.verarbeitet
            alleFehler.push(...(d.fehler ?? []))
          } else {
            alleFehler.push({ externalId: `Block ${Math.floor(i / BLOCK) + 1}`, grund: t('fehlerImport') })
          }
        } catch {
          alleFehler.push({ externalId: `Block ${Math.floor(i / BLOCK) + 1}`, grund: t('fehlerImport') })
        }
        setFortschritt({ fertig: Math.min(i + BLOCK, gesamt), gesamt })
      }
      setErgebnis({ neu, aktualisiert, verarbeitet, fehler: alleFehler })
    } catch {
      setFehler(t('fehlerImport'))
    } finally {
      setBusy(false)
      setFortschritt(null)
    }
  }

  const geoOk = Boolean(mapping.adresse || (mapping.lat && mapping.lng))
  const bereit = Boolean(mapping.external_id) && geoOk

  return (
    <div className="mt-6 flex flex-col gap-5">
      {/* Datei wählen — nur im Standalone-Modus. Inline (vom Dashboard) kommt
          die Datei bereits mit; dann nur die Spalten-Erkennung anzeigen. */}
      {initialText ? (
        headers.length > 0 && (
          <p className="text-sm text-[var(--color-muted)]">
            {t('erkannt', { spalten: headers.length, zeilen: anzahl })}
          </p>
        )
      ) : (
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
      )}

      {fehler && <p className="text-sm text-[var(--color-danger)]">⚠ {fehler}</p>}

      {/* Spaltenzuordnung */}
      {headers.length > 0 && !ergebnis && (
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold">{t('zuordnung')}</h2>
          <p className="mt-1 text-xs text-[var(--color-faint)]">{t('zuordnungHinweis')}</p>
          <div className="mt-3 flex flex-col gap-2">
            {ZIELFELDER.map((f) => (
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

          {/* Fortschritt beim Blockweise-Import (große Dateien). */}
          {fortschritt && (
            <div className="mt-4" aria-live="polite">
              <div className="flex justify-between text-sm text-[var(--color-muted)]">
                <span>{t('fortschritt', { fertig: fortschritt.fertig, gesamt: fortschritt.gesamt })}</span>
                <span>
                  {fortschritt.gesamt > 0
                    ? Math.round((fortschritt.fertig / fortschritt.gesamt) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-line)]">
                <div
                  className="h-full bg-[var(--color-accent-strong)] transition-all"
                  style={{
                    width: `${fortschritt.gesamt > 0 ? (fortschritt.fertig / fortschritt.gesamt) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
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
