import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export type DienstNavId =
  | 'dashboard'
  | 'klienten'
  | 'leistungen'
  | 'berichte'
  | 'abrechnung'
  | 'team'

// Schlichtes Stroke-Icon je Menüpunkt (einheitliche Linienstärke, keine Emojis).
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
    case 'dashboard': // Route (Tourenplanung)
      return (
        <svg {...p}>
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M8 18h4a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" />
        </svg>
      )
    case 'klienten': // Person
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        </svg>
      )
    case 'leistungen': // Klemmbrett mit Liste
      return (
        <svg {...p}>
          <rect x="6" y="5" width="12" height="15" rx="2" />
          <path d="M9.5 5V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V5" />
          <path d="M9 11h6M9 14.5h4" />
        </svg>
      )
    case 'berichte': // Balkendiagramm
      return (
        <svg {...p}>
          <path d="M5 20h14" />
          <path d="M8 20v-5M12 20v-9M16 20v-3" />
        </svg>
      )
    case 'abrechnung': // Euro im Kreis
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M14.5 9.2a3.2 3.2 0 1 0 0 5.6" />
          <path d="M8.5 11.2h4.5M8.5 12.8h4.5" />
        </svg>
      )
    case 'team': // Zwei Personen
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

// Gemeinsame App-Shell für den Dienst-Bereich: linkes Seitenmenü (Desktop) bzw.
// horizontale Leiste (Handy) + Inhalt. Das aktive Ziel ist hervorgehoben.
// Team ist nur für den Dienst-Inhaber (admin) sichtbar.
export async function DienstShell({
  role,
  active,
  children,
}: {
  role: string
  active: DienstNavId
  children: ReactNode
}) {
  const t = await getTranslations('dashboard')
  const items: { id: DienstNavId; href: string; label: string; adminOnly?: boolean }[] = [
    { id: 'dashboard', href: '/dashboard', label: t('navDashboard') },
    { id: 'klienten', href: '/dienst/klienten', label: t('klientenLink') },
    { id: 'leistungen', href: '/dienst/leistungen', label: t('leistungenLink') },
    { id: 'berichte', href: '/berichte', label: t('berichteLink') },
    { id: 'abrechnung', href: '/abrechnung', label: t('abrechnungLink') },
    { id: 'team', href: '/dienst/team', label: t('teamLink'), adminOnly: true },
  ]
  const sichtbar = items.filter((i) => !i.adminOnly || role === 'admin')

  return (
    <main className="container-page max-w-7xl py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-52 lg:shrink-0">
          <nav
            aria-label="Dienst-Navigation"
            className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-20 lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {sichtbar.map((i) => {
              const aktiv = i.id === active
              return (
                <Link
                  key={i.id}
                  href={i.href}
                  aria-current={aktiv ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
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
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  )
}
