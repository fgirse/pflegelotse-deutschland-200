'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function ersterDesMonats(): string {
  const d = new Date()
  return iso(new Date(d.getFullYear(), d.getMonth(), 1))
}
function letzterDesMonats(): string {
  const d = new Date()
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

// Zeitraum wählen und die beiden Abrechnungs-Exporte herunterladen. Die Downloads
// gehen als GET an die geschützten Endpoints (Auth-Cookie same-origin).
export function AbrechnungClient() {
  const t = useTranslations('abrechnung')
  const [von, setVon] = useState(ersterDesMonats())
  const [bis, setBis] = useState(letzterDesMonats())
  const query = `?von=${von}&bis=${bis}`

  return (
    <div className="card flex flex-col gap-3 p-5">
      <label className="label">
        {t('von')}
        <input className="input" type="date" value={von} onChange={(e) => setVon(e.target.value)} />
      </label>
      <label className="label">
        {t('bis')}
        <input className="input" type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <a href={`/api/v1/abrechnung/datev${query}`} download className="btn btn-primary">
          {t('datev')}
        </a>
        <a href={`/api/v1/abrechnung/kassen${query}`} download className="btn btn-outline">
          {t('kassen')}
        </a>
      </div>
      <p className="text-xs text-[var(--color-faint)]">{t('hinweis')}</p>
    </div>
  )
}
