'use client'

import { useTranslations } from 'next-intl'
import { minToHHMM } from '@/shared/time'

interface Zeile {
  datum: string
  istAnkunft: number | null
  istAbfahrt: number | null
  erbrachteLeistungen: string[]
  bestaetigtVon: string
}
interface Doc {
  integritaet: boolean
  klient: { name: string; adresse: string | null }
  eintraege: Zeile[]
  markdown: string
}

// Rendert den Leistungsnachweis druckfreundlich, mit Integritäts-Badge der
// Hash-Kette und Buttons zum Drucken / Markdown-Export.
export function NachweisView({ doc }: { doc: Doc }) {
  const t = useTranslations('nachweis')

  function markdownLaden() {
    const blob = new Blob([doc.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leistungsnachweis-${doc.klient.name.replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="mt-1 font-medium">{doc.klient.name}</p>
          {doc.klient.adresse && <p className="text-sm text-[var(--color-muted)]">{doc.klient.adresse}</p>}
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={() => window.print()} className="btn btn-primary min-h-9 px-3 py-1 text-sm">
            {t('drucken')}
          </button>
          <button onClick={markdownLaden} className="btn btn-outline min-h-9 px-3 py-1 text-sm">
            {t('markdown')}
          </button>
        </div>
      </div>

      <p
        className={`mb-4 rounded-lg p-3 text-sm ${
          doc.integritaet
            ? 'bg-[var(--color-accent-soft)] text-[var(--color-success)]'
            : 'text-[var(--color-danger)]'
        }`}
      >
        {doc.integritaet ? `✓ ${t('integer')}` : `⚠ ${t('gebrochen')}`}
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
            <th className="py-1 pr-3">{t('datum')}</th>
            <th className="py-1 pr-3">{t('zeit')}</th>
            <th className="py-1 pr-3">{t('leistungen')}</th>
            <th className="py-1 pr-3">{t('bestaetigtVon')}</th>
          </tr>
        </thead>
        <tbody>
          {doc.eintraege.map((e, i) => (
            <tr key={i} className="border-b border-[var(--color-line)]">
              <td className="py-1 pr-3">{e.datum}</td>
              <td className="py-1 pr-3">
                {e.istAnkunft != null ? minToHHMM(e.istAnkunft) : '—'}
                {e.istAbfahrt != null ? `–${minToHHMM(e.istAbfahrt)}` : ''}
              </td>
              <td className="py-1 pr-3">{e.erbrachteLeistungen.join(', ') || '—'}</td>
              <td className="py-1 pr-3">{e.bestaetigtVon}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-xs text-[var(--color-faint)]">{t('fuss', { n: doc.eintraege.length })}</p>
    </div>
  )
}
