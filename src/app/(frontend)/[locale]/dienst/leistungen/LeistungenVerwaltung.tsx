'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { LeistungEintrag } from '@/shared/leistungskatalog'

const CODE = /^[A-Za-z0-9]{1,16}$/

// Zahl-Eingabe (String) → Zahl oder undefined.
function zahl(v: string, dezimal = false): number | undefined {
  if (!v.trim()) return undefined
  const n = dezimal ? Number.parseFloat(v.replace(',', '.')) : Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : undefined
}

export function LeistungenVerwaltung({ anfang }: { anfang: LeistungEintrag[] }) {
  const t = useTranslations('leistungen')
  const [liste, setListe] = useState<LeistungEintrag[]>(anfang)

  // Editor: editCode = null → Neu (Code editierbar), sonst Bearbeiten (Code fix).
  const [editCode, setEditCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [bezeichnung, setBezeichnung] = useState('')
  const [quali, setQuali] = useState('')
  const [dauer, setDauer] = useState('')
  const [grundzeit, setGrundzeit] = useState('')
  const [preis, setPreis] = useState('')
  const [aktiv, setAktiv] = useState(true)

  const [busy, setBusy] = useState(false)
  const [aktionBusy, setAktionBusy] = useState<string | null>(null)
  const [erfolg, setErfolg] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  function neu() {
    setEditCode(null)
    setCode('')
    setBezeichnung('')
    setQuali('')
    setDauer('')
    setGrundzeit('')
    setPreis('')
    setAktiv(true)
    setErfolg(null)
    setFehler(null)
  }

  function bearbeiten(e: LeistungEintrag) {
    setEditCode(e.code)
    setCode(e.code)
    setBezeichnung(e.bezeichnung)
    setQuali(e.qualifikation ?? '')
    setDauer(e.dauerMin != null ? String(e.dauerMin) : '')
    setGrundzeit(e.grundzeitMin != null ? String(e.grundzeitMin) : '')
    setPreis(e.preis != null ? String(e.preis) : '')
    setAktiv(e.aktiv)
    setErfolg(null)
    setFehler(null)
  }

  const effektiverCode = (editCode ?? code).trim()
  const gueltig = CODE.test(effektiverCode) && bezeichnung.trim().length > 0

  async function speichern() {
    if (!gueltig || busy) return
    setBusy(true)
    setErfolg(null)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/leistungen/${encodeURIComponent(effektiverCode)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bezeichnung: bezeichnung.trim(),
          qualifikation: quali || undefined,
          dauerMin: zahl(dauer),
          grundzeitMin: zahl(grundzeit),
          preis: zahl(preis, true),
          aktiv,
        }),
      })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      const { eintrag } = (await res.json()) as { eintrag: LeistungEintrag }
      setListe((l) => {
        const rest = l.filter((x) => x.code !== eintrag.code)
        return [...rest, eintrag].sort((a, b) => a.code.localeCompare(b.code))
      })
      // Erst Felder zurücksetzen, dann Erfolg setzen (neu() würde ihn sonst leeren).
      neu()
      setErfolg(t('erfolg', { code: eintrag.code }))
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setBusy(false)
    }
  }

  async function loeschen(e: LeistungEintrag) {
    if (aktionBusy) return
    if (!window.confirm(t('loeschenBestaetigen', { code: e.code }))) return
    setAktionBusy(e.code)
    setErfolg(null)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/leistungen/${encodeURIComponent(e.code)}`, { method: 'DELETE' })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      setListe((l) => l.filter((x) => x.code !== e.code))
      if (editCode === e.code) neu()
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setAktionBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Editor (Neu/Bearbeiten) */}
      <section className="card p-5">
        <h2 className="font-display text-lg font-semibold">
          {editCode ? t('bearbeitenTitel', { code: editCode }) : t('neuTitel')}
        </h2>
        {erfolg && <p className="mt-3 rounded-lg bg-accent-soft p-3 text-sm text-accent">{erfolg}</p>}
        {fehler && <p className="mt-3 text-sm text-danger">⚠ {fehler}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="label">
            {t('code')}
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={editCode !== null}
              placeholder="LK01"
            />
          </label>
          <label className="label">
            {t('bezeichnung')}
            <input className="input" value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} />
          </label>
          <label className="label">
            {t('qualifikation')}
            <select className="input" value={quali} onChange={(e) => setQuali(e.target.value)}>
              <option value="">{t('qualiKeine')}</option>
              <option value="grundpflege">{t('qualiGrundpflege')}</option>
              <option value="behandlungspflege">{t('qualiBehandlungspflege')}</option>
            </select>
          </label>
          <label className="label">
            {t('preis')}
            <input
              className="input"
              inputMode="decimal"
              value={preis}
              onChange={(e) => setPreis(e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label className="label">
            {t('dauer')}
            <input
              className="input"
              type="number"
              min={0}
              value={dauer}
              onChange={(e) => setDauer(e.target.value)}
            />
          </label>
          <label className="label">
            {t('grundzeit')}
            <input
              className="input"
              type="number"
              min={0}
              value={grundzeit}
              onChange={(e) => setGrundzeit(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
            {t('aktivLabel')}
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={speichern} disabled={busy || !gueltig} className="btn btn-primary">
            {editCode ? t('speichern') : t('anlegen')}
          </button>
          {editCode && (
            <button type="button" onClick={neu} className="btn btn-outline">
              {t('neuButton')}
            </button>
          )}
        </div>
      </section>

      {/* Katalog-Tabelle */}
      <section className="card p-5">
        <h2 className="font-display text-lg font-semibold">{t('listeTitel')}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                <th className="py-2 pr-4 font-medium">{t('code')}</th>
                <th className="py-2 pr-4 font-medium">{t('bezeichnung')}</th>
                <th className="py-2 pr-4 font-medium">{t('qualifikation')}</th>
                <th className="py-2 pr-4 font-medium">{t('dauerKurz')}</th>
                <th className="py-2 pr-4 font-medium">{t('grundzeitKurz')}</th>
                <th className="py-2 pr-4 font-medium">{t('preisKurz')}</th>
                <th className="py-2 font-medium">{t('spalteAktionen')}</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((e) => (
                <tr
                  key={e.code}
                  className={`border-b border-[var(--color-line)] last:border-0 ${
                    e.aktiv ? '' : 'text-[var(--color-faint)]'
                  }`}
                >
                  <td className="py-2 pr-4 font-medium">{e.code}</td>
                  <td className="py-2 pr-4">{e.bezeichnung}</td>
                  <td className="py-2 pr-4">
                    {e.qualifikation
                      ? t(e.qualifikation === 'grundpflege' ? 'qualiGrundpflege' : 'qualiBehandlungspflege')
                      : '—'}
                  </td>
                  <td className="py-2 pr-4">{e.dauerMin != null ? e.dauerMin : '—'}</td>
                  <td className="py-2 pr-4">{e.grundzeitMin != null ? e.grundzeitMin : '—'}</td>
                  <td className="py-2 pr-4">{e.preis != null ? e.preis.toFixed(2) : '—'}</td>
                  <td className="py-2">
                    <div className="flex gap-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => bearbeiten(e)}
                        className="font-medium text-[var(--color-accent)] hover:underline"
                      >
                        {t('bearbeiten')}
                      </button>
                      <button
                        type="button"
                        onClick={() => loeschen(e)}
                        disabled={aktionBusy === e.code}
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
      </section>
    </div>
  )
}
