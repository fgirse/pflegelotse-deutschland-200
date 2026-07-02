'use client'

import { useState } from 'react'

// Passwort-Eingabe mit „anzeigen/verbergen"-Umschalter (Auge-Symbol im Feld).
// So kann die Nutzerin prüfen, was sie tippt — bessere UX, weniger Tippfehler.
export function PasswortFeld({
  value,
  onChange,
  autoComplete = 'current-password',
  labelAnzeigen = 'Passwort anzeigen',
  labelVerbergen = 'Passwort verbergen',
}: {
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  labelAnzeigen?: string
  labelVerbergen?: string
}) {
  const [sichtbar, setSichtbar] = useState(false)
  return (
    <div className="relative">
      <input
        type={sichtbar ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="input pr-11"
      />
      <button
        type="button"
        onClick={() => setSichtbar((s) => !s)}
        aria-pressed={sichtbar}
        aria-label={sichtbar ? labelVerbergen : labelAnzeigen}
        title={sichtbar ? labelVerbergen : labelAnzeigen}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]"
      >
        {sichtbar ? <AugeAus /> : <Auge />}
      </button>
    </div>
  )
}

function Auge() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function AugeAus() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 4.6A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.4" />
      <path d="M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 3-.5" />
    </svg>
  )
}
