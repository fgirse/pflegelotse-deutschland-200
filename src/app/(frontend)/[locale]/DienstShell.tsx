import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { DienstNav, type DienstNavId } from './DienstNav'

export type { DienstNavId }

// Gemeinsame App-Shell für den Dienst-Bereich: linkes Seitenmenü (Desktop) bzw.
// ausklappbares Panel (Handy) + Inhalt. Menüpunkte/Rollenfilter kommen vom
// Server; die Interaktion (Handy-Umschalter) steckt in DienstNav.
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
  const alle: { id: DienstNavId; href: string; label: string; adminOnly?: boolean }[] = [
    { id: 'dashboard', href: '/dashboard', label: t('navDashboard') },
    { id: 'klienten', href: '/dienst/klienten', label: t('klientenLink') },
    { id: 'leistungen', href: '/dienst/leistungen', label: t('leistungenLink') },
    { id: 'berichte', href: '/berichte', label: t('berichteLink') },
    { id: 'abrechnung', href: '/abrechnung', label: t('abrechnungLink') },
    { id: 'team', href: '/dienst/team', label: t('teamLink'), adminOnly: true },
  ]
  const items = alle
    .filter((i) => !i.adminOnly || role === 'admin')
    .map((i) => ({ id: i.id, href: i.href, label: i.label }))

  return (
    <main className="container-page max-w-7xl py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-52 lg:shrink-0">
          <DienstNav items={items} active={active} menuLabel={t('navMenue')} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  )
}
