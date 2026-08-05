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
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                    aktiv
                      ? 'bg-[var(--color-accent-soft)] font-bold text-[var(--color-accent)]'
                      : 'font-medium text-[var(--color-muted)] hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]'
                  }`}
                >
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
