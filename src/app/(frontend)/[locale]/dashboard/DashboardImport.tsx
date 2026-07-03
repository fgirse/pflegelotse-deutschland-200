'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ImportClient } from '../dienst/import/ImportClient'

// Prominenter CSV/Excel-Upload direkt im Dashboard: Datei per Button wählen oder
// hineinziehen (Drag & Drop). Ist eine Datei gewählt, läuft der komplette Import
// (Spaltenzuordnung + Import) INLINE hier — ohne Seitenwechsel.
export function DashboardImport() {
  const t = useTranslations('dashboard')
  const inputRef = useRef<HTMLInputElement>(null)
  const [drueber, setDrueber] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [dateiName, setDateiName] = useState('')

  async function nimmDatei(file?: File | null) {
    if (!file) return
    setDateiName(file.name)
    setText(await file.text())
  }

  // Ist eine Datei gewählt → kompletten Import inline anzeigen.
  if (text !== null) {
    return (
      <section className="mb-6 card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="font-display text-lg font-semibold">{t('importTitel')}</div>
          <button
            type="button"
            onClick={() => {
              setText(null)
              setDateiName('')
            }}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            {t('importAndereDatei')}
          </button>
        </div>
        {dateiName && <p className="mt-1 text-sm text-[var(--color-muted)]">{dateiName}</p>}
        <ImportClient initialText={text} />
      </section>
    )
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
