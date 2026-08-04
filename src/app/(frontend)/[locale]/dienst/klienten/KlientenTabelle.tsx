'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { KlientListenZeile } from '@/server/klienten/liste'

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

  const [busy, setBusy] = useState(false)
  const [erfolg, setErfolg] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  function oeffne(k: KlientListenZeile) {
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

  async function speichern() {
    if (!editFuer || busy) return
    setBusy(true)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/klienten/${editFuer.pseudonymId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
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
        }),
      })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      const { klient } = (await res.json()) as { klient: KlientListenZeile }
      setListe((l) =>
        l
          .map((x) => (x.pseudonymId === klient.pseudonymId ? klient : x))
          .sort((a, b) => a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname)),
      )
      setErfolg(t('erfolg', { name: `${klient.nachname}, ${klient.vorname}`.trim() }))
      setEditFuer(null)
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setBusy(false)
    }
  }

  function toggleLeistung(code: string) {
    setLeistungen((l) => (l.includes(code) ? l.filter((c) => c !== code) : [...l, code]))
  }

  // Auswahl-Optionen: Katalog + bereits gesetzte Codes, die (noch) nicht im
  // Katalog stehen (damit keine bestehende Auswahl verloren geht).
  const codesImKatalog = new Set(katalog.map((k) => k.code))
  const leistungOptionen = [
    ...katalog,
    ...leistungen.filter((c) => !codesImKatalog.has(c)).map((c) => ({ code: c, bezeichnung: '' })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-5">
        {erfolg && <p className="mb-3 rounded-lg bg-accent-soft p-3 text-sm text-accent">{erfolg}</p>}
        {liste.length === 0 ? (
          <p className="text-sm text-[var(--color-faint)]">{t('leer')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                  <th className="py-2 pr-4 font-medium">{t('spalteName')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalteGeburt')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalteVersicherung')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalteLeistungen')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spaltePflegegrad')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalteStatus')}</th>
                  <th className="py-2 font-medium">{t('spalteAktionen')}</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((k) => (
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
                      <button
                        type="button"
                        onClick={() => oeffne(k)}
                        className="font-medium text-[var(--color-accent)] hover:underline"
                      >
                        {t('bearbeiten')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bearbeiten-Panel */}
      {editFuer && (
        <section className="card border-2 border-[var(--color-accent)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">
              {t('bearbeitenTitel', { name: `${editFuer.nachname}, ${editFuer.vorname}`.trim() || '—' })}
            </h2>
            <button
              type="button"
              onClick={() => setEditFuer(null)}
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
              {/* Bei gesetzlich: Dropdown aus der Kassenliste; sonst Freitext. */}
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
              {t('speichern')}
            </button>
            <button type="button" onClick={() => setEditFuer(null)} className="btn btn-outline">
              {t('abbrechen')}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
