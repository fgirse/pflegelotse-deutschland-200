'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { KlientListenZeile } from '@/server/klienten/liste'

// "HH:MM" → Minuten seit Mitternacht; null bei ungültiger Eingabe.
function hhmmZuMin(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function KlientenTabelle({
  anfang,
  kassen,
  katalog,
}: {
  anfang: KlientListenZeile[]
  kassen: string[]
  katalog: { code: string; bezeichnung: string }[]
}) {
  const t = useTranslations('klienten')
  const [liste, setListe] = useState(anfang)
  const [editFuer, setEditFuer] = useState<KlientListenZeile | null>(null)
  const [neu, setNeu] = useState(false)

  // Formularfelder
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [geburtsdatum, setGeburtsdatum] = useState('')
  const [adresse, setAdresse] = useState('')
  const [telefon, setTelefon] = useState('')
  const [email, setEmail] = useState('')
  const [kostentraeger, setKostentraeger] = useState('')
  const [kasse, setKasse] = useState('')
  const [leistungen, setLeistungen] = useState<string[]>([])
  const [pflegegrad, setPflegegrad] = useState('')
  const [status, setStatus] = useState('aktiv')

  // Nur beim Anlegen: Koordinaten (aus Adresse geocodiert) + Zeitfenster.
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLabel, setGeoLabel] = useState<string | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [zeitVon, setZeitVon] = useState('08:00')
  const [zeitBis, setZeitBis] = useState('10:00')

  const [busy, setBusy] = useState(false)
  const [aktionBusy, setAktionBusy] = useState<string | null>(null)
  const [erfolg, setErfolg] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  // Suche + Filter (clientseitig — die Liste ist bereits geladen).
  const [suche, setSuche] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fVersicherung, setFVersicherung] = useState('')
  const [fPflegegrad, setFPflegegrad] = useState('')

  // Sortierung nach Spalte.
  type SortKey = 'name' | 'geburtsdatum' | 'versicherung' | 'pflegegrad' | 'status'
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  function sortieren(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function felderLeeren() {
    setVorname('')
    setNachname('')
    setGeburtsdatum('')
    setAdresse('')
    setTelefon('')
    setEmail('')
    setKostentraeger('')
    setKasse('')
    setLeistungen([])
    setPflegegrad('')
    setStatus('aktiv')
    setErfolg(null)
    setFehler(null)
  }

  function schliessen() {
    setEditFuer(null)
    setNeu(false)
  }

  function oeffne(k: KlientListenZeile) {
    setNeu(false)
    setEditFuer(k)
    setVorname(k.vorname)
    setNachname(k.nachname)
    setGeburtsdatum(k.geburtsdatum ?? '')
    setAdresse(k.adresse ?? '')
    setTelefon(k.telefon ?? '')
    setEmail(k.email ?? '')
    setKostentraeger(k.kostentraegerArt ?? '')
    setKasse(k.krankenversicherer ?? '')
    setLeistungen(k.leistungen)
    setPflegegrad(k.pflegegrad != null ? String(k.pflegegrad) : '')
    setStatus(k.status || 'aktiv')
    setErfolg(null)
    setFehler(null)
  }

  function oeffneNeu() {
    setEditFuer(null)
    setNeu(true)
    felderLeeren()
    setGeo(null)
    setGeoLabel(null)
    setZeitVon('08:00')
    setZeitBis('10:00')
  }

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

  function felder() {
    return {
      vorname,
      nachname,
      geburtsdatum,
      adresse,
      telefon,
      email,
      kostentraegerArt: kostentraeger,
      krankenversicherer: kasse,
      leistungen,
      pflegegrad: pflegegrad ? Number(pflegegrad) : null,
      status,
    }
  }

  function einsortieren(k: KlientListenZeile, l: KlientListenZeile[]) {
    return [...l.filter((x) => x.pseudonymId !== k.pseudonymId), k].sort(
      (a, b) => a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname),
    )
  }

  async function speichern() {
    if (busy) return
    setBusy(true)
    setFehler(null)
    try {
      if (neu) {
        if (!geo) {
          setFehler(t('geoFehlt'))
          return
        }
        const von = hhmmZuMin(zeitVon)
        const bis = hhmmZuMin(zeitBis)
        if (von == null || bis == null) {
          setFehler(t('zeitUngueltig'))
          return
        }
        const res = await fetch('/api/v1/klienten', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...felder(), geo, zeitfenster: { von, bis } }),
        })
        if (!res.ok) {
          setFehler(t('fehlerAllgemein'))
          return
        }
        const { klient } = (await res.json()) as { klient: KlientListenZeile }
        setListe((l) => einsortieren(klient, l))
        setErfolg(t('neuErfolg', { name: `${klient.nachname}, ${klient.vorname}`.trim() }))
        setNeu(false)
      } else if (editFuer) {
        const res = await fetch(`/api/v1/klienten/${editFuer.pseudonymId}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(felder()),
        })
        if (!res.ok) {
          setFehler(t('fehlerAllgemein'))
          return
        }
        const { klient } = (await res.json()) as { klient: KlientListenZeile }
        setListe((l) => einsortieren(klient, l))
        setErfolg(t('erfolg', { name: `${klient.nachname}, ${klient.vorname}`.trim() }))
        setEditFuer(null)
      }
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setBusy(false)
    }
  }

  async function loeschen(k: KlientListenZeile) {
    if (aktionBusy) return
    const name = `${k.nachname}, ${k.vorname}`.trim() || '—'
    if (!window.confirm(t('loeschenBestaetigen', { name }))) return
    setAktionBusy(k.pseudonymId)
    setErfolg(null)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/klienten/${k.pseudonymId}`, { method: 'DELETE' })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      setListe((l) => l.filter((x) => x.pseudonymId !== k.pseudonymId))
      if (editFuer?.pseudonymId === k.pseudonymId) schliessen()
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setAktionBusy(null)
    }
  }

  function toggleLeistung(code: string) {
    setLeistungen((l) => (l.includes(code) ? l.filter((c) => c !== code) : [...l, code]))
  }

  const codesImKatalog = new Set(katalog.map((k) => k.code))
  const leistungOptionen = [
    ...katalog,
    ...leistungen.filter((c) => !codesImKatalog.has(c)).map((c) => ({ code: c, bezeichnung: '' })),
  ]
  const panelOffen = neu || editFuer !== null

  // Angewandte Suche/Filter.
  const q = suche.trim().toLowerCase()
  const gefiltert = liste.filter((k) => {
    if (fStatus && k.status !== fStatus) return false
    if (fVersicherung && (k.kostentraegerArt ?? '') !== fVersicherung) return false
    if (fPflegegrad && String(k.pflegegrad ?? '') !== fPflegegrad) return false
    if (q) {
      const heu = `${k.vorname} ${k.nachname} ${k.krankenversicherer ?? ''} ${k.leistungen.join(' ')}`
      if (!heu.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Sortierschlüssel je Zeile (leere Werte hinten via ￿ / Infinity).
  function sortWert(k: KlientListenZeile): string | number {
    switch (sortKey) {
      case 'geburtsdatum':
        return k.geburtsdatum || '￿'
      case 'versicherung':
        return k.kostentraegerArt ? `${k.kostentraegerArt} ${k.krankenversicherer ?? ''}` : '￿'
      case 'pflegegrad':
        return k.pflegegrad ?? Infinity
      case 'status':
        return k.status
      default:
        return `${k.nachname} ${k.vorname}`.trim() || '￿'
    }
  }
  const sortiert = [...gefiltert].sort((a, b) => {
    const av = sortWert(a)
    const bv = sortWert(b)
    const c =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? c : -c
  })
  const pfeil = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{t('listeTitel')}</h2>
          <button onClick={oeffneNeu} className="btn btn-primary min-h-9 px-3 text-sm">
            + {t('neuerKlient')}
          </button>
        </div>
        {erfolg && <p className="mb-3 rounded-lg bg-accent-soft p-3 text-sm text-accent">{erfolg}</p>}
        {liste.length === 0 ? (
          <p className="text-sm text-[var(--color-faint)]">{t('leer')}</p>
        ) : (
          <>
            {/* Suche + Filter */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                className="input max-w-[16rem]"
                placeholder={t('suchePlatzhalter')}
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
              />
              <select className="input w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">{t('filterStatusAlle')}</option>
                <option value="aktiv">{t('status_aktiv')}</option>
                <option value="pausiert">{t('status_pausiert')}</option>
                <option value="beendet">{t('status_beendet')}</option>
              </select>
              <select
                className="input w-auto"
                value={fVersicherung}
                onChange={(e) => setFVersicherung(e.target.value)}
              >
                <option value="">{t('filterVersAlle')}</option>
                <option value="gesetzlich">{t('gesetzlich')}</option>
                <option value="privat">{t('privat')}</option>
              </select>
              <select
                className="input w-auto"
                value={fPflegegrad}
                onChange={(e) => setFPflegegrad(e.target.value)}
              >
                <option value="">{t('filterPgAlle')}</option>
                {[1, 2, 3, 4, 5].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <span className="text-sm text-[var(--color-muted)]">
                {t('trefferAnzahl', { n: gefiltert.length })}
              </span>
            </div>
            {gefiltert.length === 0 ? (
              <p className="text-sm text-[var(--color-faint)]">{t('keineTreffer')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                  {(
                    [
                      ['name', 'spalteName'],
                      ['geburtsdatum', 'spalteGeburt'],
                      ['versicherung', 'spalteVersicherung'],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      className="py-2 pr-4 font-medium"
                      aria-sort={
                        sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                    >
                      <button
                        type="button"
                        onClick={() => sortieren(key)}
                        className="font-medium hover:text-[var(--color-ink)]"
                      >
                        {t(label)}
                        {pfeil(key)}
                      </button>
                    </th>
                  ))}
                  <th className="py-2 pr-4 font-medium">{t('spalteLeistungen')}</th>
                  {(
                    [
                      ['pflegegrad', 'spaltePflegegrad'],
                      ['status', 'spalteStatus'],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      className="py-2 pr-4 font-medium"
                      aria-sort={
                        sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                    >
                      <button
                        type="button"
                        onClick={() => sortieren(key)}
                        className="font-medium hover:text-[var(--color-ink)]"
                      >
                        {t(label)}
                        {pfeil(key)}
                      </button>
                    </th>
                  ))}
                  <th className="py-2 font-medium">{t('spalteAktionen')}</th>
                </tr>
              </thead>
              <tbody>
                {sortiert.map((k) => (
                  <tr key={k.pseudonymId} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="py-2 pr-4">
                      {k.nachname || k.vorname ? (
                        <span className="font-medium">
                          {k.nachname}
                          {k.nachname && k.vorname ? ', ' : ''}
                          {k.vorname}
                        </span>
                      ) : (
                        <span className="text-[var(--color-faint)]">{t('ohneIdentitaet')}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{k.geburtsdatum ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {k.kostentraegerArt
                        ? t(k.kostentraegerArt === 'gesetzlich' ? 'gesetzlich' : 'privat')
                        : '—'}
                      {k.krankenversicherer ? ` · ${k.krankenversicherer}` : ''}
                    </td>
                    <td className="py-2 pr-4">
                      {k.leistungen.length > 0 ? (
                        k.leistungen.join(', ')
                      ) : (
                        <span className="text-[var(--color-faint)]">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{k.pflegegrad ?? '—'}</td>
                    <td className="py-2 pr-4">{t(`status_${k.status}`)}</td>
                    <td className="py-2">
                      <div className="flex gap-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => oeffne(k)}
                          className="font-medium text-[var(--color-accent)] hover:underline"
                        >
                          {t('bearbeiten')}
                        </button>
                        <button
                          type="button"
                          onClick={() => loeschen(k)}
                          disabled={aktionBusy === k.pseudonymId}
                          className="font-medium text-[var(--color-danger)] hover:underline disabled:opacity-50"
                        >
                          {t('loeschen')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* Anlegen-/Bearbeiten-Panel */}
      {panelOffen && (
        <section className="card border-2 border-[var(--color-accent)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">
              {neu
                ? t('neuerKlient')
                : t('bearbeitenTitel', {
                    name: `${editFuer?.nachname}, ${editFuer?.vorname}`.trim() || '—',
                  })}
            </h2>
            <button
              type="button"
              onClick={schliessen}
              className="text-sm text-[var(--color-muted)] hover:underline"
            >
              {t('abbrechen')}
            </button>
          </div>
          {fehler && <p className="mt-3 text-sm text-danger">⚠ {fehler}</p>}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="label">
              {t('vorname')}
              <input className="input" value={vorname} onChange={(e) => setVorname(e.target.value)} />
            </label>
            <label className="label">
              {t('nachname')}
              <input className="input" value={nachname} onChange={(e) => setNachname(e.target.value)} />
            </label>
            <label className="label">
              {t('spalteGeburt')}
              <input
                type="date"
                className="input"
                value={geburtsdatum}
                onChange={(e) => setGeburtsdatum(e.target.value)}
              />
            </label>
            <label className="label">
              {t('adresse')}
              <input className="input" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
            </label>

            {/* Nur beim Anlegen: Adresse → Koordinaten + Zeitfenster. */}
            {neu && (
              <>
                <div className="label sm:col-span-2">
                  {t('adresseSuche')}
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={adresseSuchen}
                      disabled={geoBusy || adresse.trim().length < 3}
                      className="btn btn-outline shrink-0"
                    >
                      {t('suchen')}
                    </button>
                    {geoLabel && (
                      <span className="text-xs text-[var(--color-faint)]">
                        {geo ? `✓ ${geoLabel}` : geoLabel}
                      </span>
                    )}
                  </div>
                </div>
                <label className="label">
                  {t('zeitVon')}
                  <input
                    type="time"
                    className="input"
                    value={zeitVon}
                    onChange={(e) => setZeitVon(e.target.value)}
                  />
                </label>
                <label className="label">
                  {t('zeitBis')}
                  <input
                    type="time"
                    className="input"
                    value={zeitBis}
                    onChange={(e) => setZeitBis(e.target.value)}
                  />
                </label>
              </>
            )}

            <label className="label">
              {t('telefon')}
              <input className="input" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
            </label>
            <label className="label">
              {t('email')}
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>

            <label className="label">
              {t('kostentraeger')}
              <select
                className="input"
                value={kostentraeger}
                onChange={(e) => setKostentraeger(e.target.value)}
              >
                <option value="">{t('kostentraegerLeer')}</option>
                <option value="gesetzlich">{t('gesetzlich')}</option>
                <option value="privat">{t('privat')}</option>
              </select>
            </label>
            <label className="label">
              {t('krankenkasse')}
              {kostentraeger === 'gesetzlich' ? (
                <select className="input" value={kasse} onChange={(e) => setKasse(e.target.value)}>
                  <option value="">—</option>
                  {kassen.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="input" value={kasse} onChange={(e) => setKasse(e.target.value)} />
              )}
            </label>

            <div className="label sm:col-span-2">
              {t('spalteLeistungen')}
              {leistungOptionen.length === 0 ? (
                <span className="mt-1 block text-xs text-[var(--color-faint)]">
                  {t('leistungenLeer')}
                </span>
              ) : (
                <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
                  {leistungOptionen.map((o) => (
                    <label key={o.code} className="flex items-center gap-2 text-sm font-normal">
                      <input
                        type="checkbox"
                        checked={leistungen.includes(o.code)}
                        onChange={() => toggleLeistung(o.code)}
                      />
                      <span className="font-medium">{o.code}</span>
                      {o.bezeichnung ? (
                        <span className="truncate text-[var(--color-muted)]">· {o.bezeichnung}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <label className="label">
              {t('spaltePflegegrad')}
              <select className="input" value={pflegegrad} onChange={(e) => setPflegegrad(e.target.value)}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              {t('spalteStatus')}
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="aktiv">{t('status_aktiv')}</option>
                <option value="pausiert">{t('status_pausiert')}</option>
                <option value="beendet">{t('status_beendet')}</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={speichern} disabled={busy} className="btn btn-primary">
              {neu ? t('anlegen') : t('speichern')}
            </button>
            <button type="button" onClick={schliessen} className="btn btn-outline">
              {t('abbrechen')}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
