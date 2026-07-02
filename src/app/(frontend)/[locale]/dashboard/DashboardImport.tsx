'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

// Prominenter CSV/Excel-Upload direkt im Dashboard: Datei per Klick wählen oder
// hineinziehen (Drag & Drop). Die Datei wird an die Import-Seite übergeben
// (via sessionStorage), wo Spaltenzuordnung + Import laufen.
export function DashboardImport() {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [drueber, setDrueber] = useState(false)

  async function nimmDatei(file?: File | null) {
    if (!file) return
    const text = await file.text()
    try {
      sessionStorage.setItem('importCsv', text)
      sessionStorage.setItem('importName', file.name)
    } catch {
      /* sessionStorage nicht verfügbar — Import-Seite öffnet dann leer */
    }
    router.push('/dienst/import')
  }

  return (
    <section
      aria-label={t('importTitel')}
      onDragOver={(e) => {
        e.preventDefault()
        setDrueber(true)
      }}
      onDragLeave={() => setDrueber(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrueber(false)
        nimmDatei(e.dataTransfer.files?.[0])
      }}
      className={`mb-6 flex flex-col items-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        drueber
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
          : 'border-[var(--color-line)]'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
      </svg>
      <h2 className="mt-2 font-display text-lg font-semibold">{t('importTitel')}</h2>
      <p className="mt-1 max-w-md text-sm text-[var(--color-muted)]">{t('importDropHinweis')}</p>
      <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-accent mt-3 min-h-11">
        {t('importDateiWaehlen')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain,application/vnd.ms-excel"
        onChange={(e) => nimmDatei(e.target.files?.[0])}
        className="hidden"
      />
    </section>
  )
}
