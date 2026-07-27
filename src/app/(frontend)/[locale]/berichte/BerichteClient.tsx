'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { MitarbeiterZeile, KilometerZeile } from '@/server/berichte/aggregat'

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const ersterDesMonats = () => iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const letzterDesMonats = () => iso(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
const h = (min: number) => (min / 60).toFixed(1)

export function BerichteClient() {
  const t = useTranslations('berichte')
  const [von, setVon] = useState(ersterDesMonats())
  const [bis, setBis] = useState(letzterDesMonats())
  const [mitarbeiter, setMitarbeiter] = useState<MitarbeiterZeile[]>([])
  const [kilometer, setKilometer] = useState<KilometerZeile[]>([])
  const [busy, setBusy] = useState(false)

  const laden = useCallback(async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/berichte?von=${von}&bis=${bis}`)
      if (res.ok) {
        const d = await res.json()
        setMitarbeiter(d.mitarbeiter ?? [])
        setKilometer(d.kilometer ?? [])
      }
    } finally {
      setBusy(false)
    }
  }, [von, bis])

  useEffect(() => {
    void laden()
  }, [laden])

  const csv = (typ: 'auslastung' | 'kilometer') => `/api/v1/berichte/csv?von=${von}&bis=${bis}&typ=${typ}`

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="label">
          {t('von')}
          <input className="input" type="date" value={von} onChange={(e) => setVon(e.target.value)} />
        </label>
        <label className="label">
          {t('bis')}
          <input className="input" type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
        </label>
        {busy && <span className="text-sm text-[var(--color-muted)]">{t('lade')}</span>}
      </div>

      {/* Mitarbeiterauslastung */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{t('auslastungTitel')}</h2>
          <a href={csv('auslastung')} download className="btn btn-outline min-h-9 px-3 py-1 text-sm">
            {t('csv')}
          </a>
        </div>
        {mitarbeiter.length === 0 ? (
          <p className="text-sm text-[var(--color-faint)]">{t('keine')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                  <th className="py-1 pr-3">{t('pflegekraft')}</th>
                  <th className="py-1 pr-3">{t('touren')}</th>
                  <th className="py-1 pr-3">{t('einsaetze')}</th>
                  <th className="py-1 pr-3">{t('arbeitszeit')}</th>
                  <th className="py-1 pr-3">{t('fahrzeit')}</th>
                  <th className="py-1 pr-3">{t('amKlienten')}</th>
                  <th className="py-1 pr-3">{t('auslastung')}</th>
                  <th className="py-1 pr-3">{t('km')}</th>
                </tr>
              </thead>
              <tbody>
                {mitarbeiter.map((m) => (
                  <tr key={m.pflegekraftId} className="border-b border-[var(--color-line)]">
                    <td className="py-1 pr-3 font-medium">{m.pflegekraftId}</td>
                    <td className="py-1 pr-3">{m.touren}</td>
                    <td className="py-1 pr-3">{m.einsaetze}</td>
                    <td className="py-1 pr-3">{h(m.arbeitszeitMin)} h</td>
                    <td className="py-1 pr-3">{h(m.fahrzeitMin)} h</td>
                    <td className="py-1 pr-3">{h(m.amKlientenMin)} h</td>
                    <td className="py-1 pr-3">{m.auslastungProzent}%</td>
                    <td className="py-1 pr-3">{m.km}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Kilometernachweis */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{t('kilometerTitel')}</h2>
          <a href={csv('kilometer')} download className="btn btn-outline min-h-9 px-3 py-1 text-sm">
            {t('csv')}
          </a>
        </div>
        {kilometer.length === 0 ? (
          <p className="text-sm text-[var(--color-faint)]">{t('keine')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                  <th className="py-1 pr-3">{t('datum')}</th>
                  <th className="py-1 pr-3">{t('pflegekraft')}</th>
                  <th className="py-1 pr-3">{t('km')}</th>
                  <th className="py-1 pr-3">{t('fahrzeit')}</th>
                </tr>
              </thead>
              <tbody>
                {kilometer.map((k, i) => (
                  <tr key={i} className="border-b border-[var(--color-line)]">
                    <td className="py-1 pr-3">{k.datum}</td>
                    <td className="py-1 pr-3">{k.pflegekraftId}</td>
                    <td className="py-1 pr-3">{k.km}</td>
                    <td className="py-1 pr-3">{h(k.fahrzeitMin)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-[var(--color-faint)]">{t('hinweis')}</p>
    </div>
  )
}
