import type { CSSProperties } from 'react'
import { Link } from '@/i18n/navigation'

// Gemeinsame Wortmarke für Header und Footer (eine Quelle der Wahrheit):
// „Pflege" in Tinte, „Lotse" im Gold-Akzent, „Deutschland" in den Farben der
// deutschen Flagge — vertikaler Verlauf mit harten Stopps (drei Bänder
// Schwarz-Rot-Gold), per background-clip auf den Text geclippt.
const flaggeStyle: CSSProperties = {
  backgroundImage:
    'linear-gradient(to bottom, #000000 0 33.333%, #DD0000 33.333% 66.666%, #FFCE00 66.666% 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent', // Safari
  color: 'transparent',
}

// className steuert nur die Größe (z. B. text-lg im Header, text-base im Footer).
export function Wordmark({ className = 'text-lg' }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="PflegeLotse Deutschland — Startseite"
      className={`whitespace-nowrap font-display font-bold tracking-tight ${className}`}
    >
      <span className="text-[var(--color-ink)]">Pflege</span>
      <span className="text-[var(--color-accent)]">Lotse</span>{' '}
      <span style={flaggeStyle}>Deutschland</span>
    </Link>
  )
}
