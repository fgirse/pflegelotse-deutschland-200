'use client'

import { useState } from 'react'
import { Link } from '@/i18n/navigation'

export type DienstNavId =
  | 'dashboard'
  | 'klienten'
  | 'leistungen'
  | 'berichte'
  | 'abrechnung'
  | 'team'

export interface DienstNavItem {
  id: DienstNavId
  href: string
  label: string
}

// Schlichtes Stroke-Icon je Menüpunkt (einheitliche Linienstärke).
function NavIcon({ id }: { id: DienstNavId }) {
  const p = {
    className: 'h-5 w-5 shrink-0',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (id) {
    case 'dashboard':
      return (
        <svg {...p}>
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M8 18h4a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" />
        </svg>
      )
    case 'klienten':
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        </svg>
      )
    case 'leistungen':
      return (
        <svg {...p}>
          <rect x="6" y="5" width="12" height="15" rx="2" />
          <path d="M9.5 5V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V5" />
          <path d="M9 11h6M9 14.5h4" />
        </svg>
      )
    case 'berichte':
      return (
        <svg {...p}>
          <path d="M5 20h14" />
          <path d="M8 20v-5M12 20v-9M16 20v-3" />
        </svg>
      )
    case 'abrechnung':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M14.5 9.2a3.2 3.2 0 1 0 0 5.6" />
          <path d="M8.5 11.2h4.5M8.5 12.8h4.5" />
        </svg>
      )
    case 'team':
      return (
        <svg {...p}>
          <circle cx="9" cy="9" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M15.5 6.2a3 3 0 0 1 0 5.6" />
          <path d="M17 13.6A5.5 5.5 0 0 1 20.5 19" />
        </svg>
      )
  }
}

// Dienst-Navigation: ab lg als statische Seitenleiste, auf dem Handy als
// ausklappbares Panel hinter einem „Menü"-Umschalter.
export function DienstNav({
  items,
  active,
  menuLabel,
}: {
  items: DienstNavItem[]
  active: DienstNavId
  menuLabel: string
}) {
  const [offen, setOffen] = useState(false)
  const aktivLabel = items.find((i) => i.id === active)?.label ?? menuLabel

  return (
    <>
      {/* Handy: Umschalter (unter lg). Zeigt den aktuellen Bereich. */}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full items-center justify-between rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] lg:hidden"
      >
        <span className="flex items-center gap-2">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          {menuLabel}
          <span className="text-[var(--color-muted)]">· {aktivLabel}</span>
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${offen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <nav
        aria-label="Dienst-Navigation"
        className={`${offen ? 'mt-2 flex' : 'hidden'} flex-col gap-1 lg:mt-0 lg:flex lg:sticky lg:top-20`}
      >
        {items.map((i) => {
          const aktiv = i.id === active
          return (
            <Link
              key={i.id}
              href={i.href}
              onClick={() => setOffen(false)}
              aria-current={aktiv ? 'page' : undefined}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                aktiv
                  ? 'bg-[var(--color-accent-soft)] font-bold text-[var(--color-accent)]'
                  : 'font-medium text-[var(--color-muted)] hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]'
              }`}
            >
              <NavIcon id={i.id} />
              {i.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
