'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Handlungsfeld } from '@/server/praevention/katalog'
import type { Empfehlung, FeldErhebung } from '@/shared/praevention'

interface Props {
  felder: Handlungsfeld[]
  klienten: { pseudonymId: string; pflegegrad?: number }[]
}

interface FeldState {
  ressourcen: string
  risiken: string[]
}

export function PraeventionClient({ felder, klienten }: Props) {
  const t = useTranslations('praevention')
  const [pseudonymId, setPseudonymId] = useState(klienten[0]?.pseudonymId ?? '')
  const [state, setState] = useState<Record<string, FeldState>>({})
  const [id, setId] = useState<string | null>(null)
  const [empfehlungen, setEmpfehlungen] = useState<Empfehlung[]>([])
  const [freitext, setFreitext] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [kiBusy, setKiBusy] = useState(false)
  const [kiFehler, setKiFehler] = useState(false)
  const [gespeichert, setGespeichert] = useState(false)

  const feldState = (fid: string): FeldState => state[fid] ?? { ressourcen: '', risiken: [] }

  function setRessourcen(fid: string, text: string) {
    setState((s) => ({ ...s, [fid]: { ...feldState(fid), ressourcen: text } }))
  }
  function toggleRisiko(fid: string, rid: string) {
    setState((s) => {
      const fs = feldState(fid)
      const risiken = fs.risiken.includes(rid)
        ? fs.risiken.filter((x) => x !== rid)
        : [...fs.risiken, rid]
      return { ...s, [fid]: { ...fs, risiken } }
    })
  }

  function baueFelder(): FeldErhebung[] {
    return felder
      .map((f) => ({ feldId: f.id, ...feldState(f.id) }))
      .filter((f) => f.risiken.length > 0 || f.ressourcen.trim())
  }

  async function erzeugen() {
    if (!pseudonymId) return
    setBusy(true)
    try {
      const res = await fetch('/api/v1/praevention', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pseudonymId, felder: baueFelder(), freitext }),
      })
      if (!res.ok) return
      const { praevention } = await res.json()
      setId(praevention.id)
      setEmpfehlungen(praevention.empfehlungen)
      setStatus(praevention.status)
    } finally {
      setBusy(false)
    }
  }

  async function speichern() {
    if (!id) return
    setBusy(true)
    setGespeichert(false)
    try {
      const res = await fetch(`/api/v1/praevention/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pseudonymId, felder: baueFelder(), empfehlungen, freitext }),
      })
      if (res.ok) {
        const { praevention } = await res.json()
        setEmpfehlungen(praevention.empfehlungen)
        setGespeichert(true)
      }
    } finally {
      setBusy(false)
    }
  }

  async function kiHilfe() {
    if (!id) return
    setKiBusy(true)
    setKiFehler(false)
    try {
      const res = await fetch(`/api/v1/praevention/${id}/ki-text`, { method: 'POST' })
      if (!res.ok) {
        setKiFehler(true)
        return
      }
      const { text } = await res.json()
      if (text) setFreitext(text)
    } catch {
      setKiFehler(true)
    } finally {
      setKiBusy(false)
    }
  }

  async function finalisieren() {
    if (!id) return
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/praevention/${id}/finalisieren`, { method: 'POST' })
      if (res.ok) {
        const { praevention } = await res.json()
        setStatus(praevention.status)
      }
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'input'
  const finalisiert = status === 'finalisiert'

  return (
    <div className="mt-6 flex flex-col gap-5">
      {/* Klient */}
      <label className="label">
        {t('klientWaehlen')}
        <select
          value={pseudonymId}
          onChange={(e) => setPseudonymId(e.target.value)}
          className={inputCls}
          disabled={Boolean(id)}
        >
          {klienten.map((k) => (
            <option key={k.pseudonymId} value={k.pseudonymId}>
              {k.pseudonymId.slice(0, 8)}… (PG {k.pflegegrad ?? '–'})
            </option>
          ))}
        </select>
      </label>

      {/* Handlungsfelder */}
      <section className="flex flex-col gap-4">
        {felder.map((f) => {
          const fs = feldState(f.id)
          return (
            <div key={f.id} className="card p-4">
              <h2 className="font-semibold">
                {f.titel}{' '}
                <span className="text-xs font-normal text-[var(--color-faint)]">({f.paragraf20})</span>
              </h2>
              <label className="label mt-2">
                {t('ressourcen')}
                <input
                  value={fs.ressourcen}
                  onChange={(e) => setRessourcen(f.id, e.target.value)}
                  className={inputCls}
                  disabled={finalisiert}
                />
              </label>
              <fieldset className="mt-2">
                <legend className="label">{t('risiken')}</legend>
                <div className="mt-1 flex flex-col gap-1">
                  {f.risiken.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={fs.risiken.includes(r.id)}
                        onChange={() => toggleRisiko(f.id, r.id)}
                        disabled={finalisiert}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )
        })}
      </section>

      {!id && (
        <button
          onClick={erzeugen}
          disabled={busy || !pseudonymId}
          className="btn btn-accent self-start"
        >
          {t('vorschlaegeErzeugen')}
        </button>
      )}

      {/* Empfehlungen */}
      {id && (
        <section className="card p-4" aria-live="polite">
          <h2 className="font-semibold">{t('empfehlungen')}</h2>
          {empfehlungen.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--color-faint)]">{t('keineEmpfehlungen')}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {empfehlungen.map((e, i) => (
                <li key={i} className="rounded-lg border border-[var(--color-line)] p-3 text-sm">
                  <div className="font-medium">
                    {e.titel}{' '}
                    <span className="text-xs text-[var(--color-faint)]">({e.paragraf20})</span>
                  </div>
                  <div className="text-[var(--color-muted)]">{e.beschreibung}</div>
                  <div className="text-[var(--color-faint)]">{e.begruendung}</div>
                </li>
              ))}
            </ul>
          )}

          <label className="label mt-4">
            {t('freitext')}
            <textarea
              value={freitext}
              onChange={(e) => setFreitext(e.target.value)}
              rows={4}
              className={inputCls}
              disabled={finalisiert}
            />
          </label>
          <p className="mt-1 text-xs text-[var(--color-faint)]">{t('kiHinweis')}</p>
          {kiFehler && <p className="text-xs text-[var(--color-danger)]">{t('kiFehler')}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {!finalisiert && (
              <>
                <button onClick={kiHilfe} disabled={kiBusy} className="btn btn-outline">
                  {t('kiHilfe')}
                </button>
                <button onClick={speichern} disabled={busy} className="btn btn-outline">
                  {gespeichert ? t('gespeichert') : t('speichern')}
                </button>
                <button onClick={finalisieren} disabled={busy} className="btn btn-primary">
                  {t('finalisieren')}
                </button>
              </>
            )}
            {finalisiert && (
              <span className="chip bg-[var(--color-accent-soft)] text-[var(--color-success)]">
                ✓ {t('finalisiert')}
              </span>
            )}
            <a href={`/api/v1/praevention/${id}/export`} className="btn btn-outline">
              {t('exportieren')}
            </a>
          </div>
        </section>
      )}
    </div>
  )
}
