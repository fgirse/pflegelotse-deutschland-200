'use client'

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

// Eingabe eines n-stelligen Zahlencodes als einzelne Kästchen (ein Feld je
// Ziffer). Macht sofort sichtbar, dass genau n Ziffern erwartet werden.
// Features: Auto-Weiterspringen, Backspace zurück, Einfügen (Paste) des ganzen
// Codes, nur Ziffern, Ziffern-Tastatur auf Mobil, OTP-Autofill, onComplete.
export function CodeInput({
  value,
  onChange,
  onComplete,
  autoFocus,
  laenge = 6,
  ariaLabel = 'Code',
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  autoFocus?: boolean
  laenge?: number
  ariaLabel?: string
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const chars = Array.from({ length: laenge }, (_, i) => value[i] ?? '')

  const fokus = (i: number) => refs.current[Math.max(0, Math.min(laenge - 1, i))]?.focus()

  function setzeAt(i: number, ziffer: string): string {
    const arr = chars.slice()
    arr[i] = ziffer
    const naechster = arr.join('').slice(0, laenge)
    onChange(naechster)
    return naechster
  }

  function beiEingabe(i: number, roh: string) {
    const ziffern = roh.replace(/\D/g, '')
    if (!ziffern) return
    // Nur die zuletzt getippte Ziffer übernehmen, dann weiter.
    const naechster = setzeAt(i, ziffern[ziffern.length - 1])
    if (i < laenge - 1) fokus(i + 1)
    if (naechster.length === laenge) onComplete?.(naechster)
  }

  function beiTaste(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (chars[i]) setzeAt(i, '')
      else if (i > 0) {
        setzeAt(i - 1, '')
        fokus(i - 1)
      }
    } else if (e.key === 'ArrowLeft') fokus(i - 1)
    else if (e.key === 'ArrowRight') fokus(i + 1)
  }

  function beiEinfuegen(e: ClipboardEvent<HTMLInputElement>) {
    const ziffern = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, laenge)
    if (!ziffern) return
    e.preventDefault()
    onChange(ziffern)
    fokus(ziffern.length)
    if (ziffern.length === laenge) onComplete?.(ziffern)
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label={ariaLabel}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={c}
          onChange={(e) => beiEingabe(i, e.target.value)}
          onKeyDown={(e) => beiTaste(i, e)}
          onPaste={beiEinfuegen}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          aria-label={`${ariaLabel} — Ziffer ${i + 1}`}
          className="h-12 w-11 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] text-center text-lg font-semibold tabular-nums text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      ))}
    </div>
  )
}
