'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { LocaleSwitcher } from './LocaleSwitcher'
import { LogoutButton } from './LogoutButton'

// ── Icons (schlichte Stroke-Icons, einheitliche Linienstärke; keine Emojis) ──
type IconProps = { className?: string }
const sw = 1.8
function IconSearch({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
function IconChat({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z" />
      <path d="M9 11h6M9 14h4" />
    </svg>
  )
}
function IconTools({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 1 5 5l-1.6-.4-1.7 1.7.4 1.6-9 9-3.4-3.4 9-9-.4-1.6 1.7-1.7Z" />
    </svg>
  )
}
function IconArea({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  )
}
function IconHome({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}
function IconMenu({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}
function IconClose({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

type NavItem = { href: string; label: string; Icon: (p: IconProps) => ReactElement }

function useNavItems(): NavItem[] {
  const t = useTranslations()
  return [
    { href: '/markt', label: t('markt.title'), Icon: IconSearch },
    { href: '/lotse', label: t('lotse.title'), Icon: IconChat },
    { href: '/tools', label: t('tools.title'), Icon: IconTools },
  ]
}

// Aktiv, wenn der Pfad die Route oder eine Unterseite davon ist.
// Sonderfall „/“: nur exakt aktiv (sonst würde startsWith alles matchen).
function istAktiv(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

// ── Desktop-Navigation (ab 1024px): Inline-Links mit Aktiv-Zustand. ──────────
export function DesktopNav() {
  const items = useNavItems()
  const pathname = usePathname()
  return (
    <nav aria-label="Hauptnavigation" className="hidden items-center gap-1 lg:flex">
      {items.map(({ href, label, Icon }) => {
        const aktiv = istAktiv(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={aktiv ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
              aktiv
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

// ── Mobiles/Tablet-Menü (unter 1024px): großer Hamburger + Schubladen-Menü. ──
export function MobileMenu({
  locale,
  isLoggedIn,
  bereichHref,
  bereichLabel,
  userLabel,
  angeboteBadge,
}: {
  locale: string
  isLoggedIn: boolean
  bereichHref: string
  bereichLabel: string
  userLabel: string
  angeboteBadge: number
}) {
  const t = useTranslations()
  const items = useNavItems()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Bei offenem Menü: Body-Scroll sperren, Esc schließt, Fokus aufs Schließen;
  // beim Schließen Fokus zurück auf den Hamburger (Tastatur-Bedienung).
  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current // beim Schließen den Fokus hierher zurück
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      trigger?.focus()
    }
  }, [open])

  // Große, gut tippbare Menüzeile (Icon + Text), Aktiv-Zustand hervorgehoben.
  const zeile = (href: string, label: string, Icon: (p: IconProps) => ReactElement, badge?: number) => {
    const aktiv = istAktiv(pathname, href)
    return (
      <Link
        href={href}
        onClick={() => setOpen(false)}
        aria-current={aktiv ? 'page' : undefined}
        className={`flex min-h-14 items-center gap-4 rounded-xl px-4 text-base font-medium transition-colors ${
          aktiv
            ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
            : 'text-[var(--color-ink)] hover:bg-[var(--color-line)]'
        }`}
      >
        <Icon className="h-6 w-6 shrink-0 text-[var(--color-accent)]" />
        <span className="flex-1">{label}</span>
        {badge && badge > 0 ? (
          <span className="rounded-full bg-[var(--color-accent-strong)] px-2 py-0.5 text-xs font-bold text-white">
            {badge}
          </span>
        ) : null}
      </Link>
    )
  }

  return (
    <div className="lg:hidden">
      {/* Hamburger: ≥44px Trefferfläche, beschriftet für Screenreader. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('nav.menueOeffnen')}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-ink)] transition-colors hover:bg-[var(--color-line)]"
      >
        <IconMenu className="h-6 w-6" />
        {angeboteBadge > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-accent-strong)]" aria-hidden />
        )}
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label={t('nav.navigation')} className="fixed inset-0 z-50">
          {/* Scrim: kräftig genug, um den Hintergrund abzusetzen; tippen schließt. */}
          <button
            type="button"
            aria-label={t('nav.menueSchliessen')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 motion-safe:animate-[pl-fade-in_150ms_ease-out]"
          />
          {/* Panel von rechts; volle Höhe (dvh), komfortable Abstände. */}
          <div className="absolute right-0 top-0 flex h-dvh w-[88%] max-w-sm flex-col overflow-y-auto bg-[var(--color-paper)] shadow-2xl motion-safe:animate-[pl-slide-in_200ms_ease-out]">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <span className="font-display text-sm font-semibold text-[var(--color-muted)]">
                {t('nav.navigation')}
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('nav.menueSchliessen')}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-ink)] transition-colors hover:bg-[var(--color-line)]"
              >
                <IconClose className="h-6 w-6" />
              </button>
            </div>

            <nav aria-label="Hauptnavigation" className="flex flex-col gap-1 p-3">
              {items.map((it) => zeile(it.href, it.label, it.Icon))}
            </nav>

            {/* Persönlicher Bereich — klar abgesetzt von der Hauptnavigation. */}
            <div className="mt-auto border-t border-[var(--color-line)] p-3">
              <p className="px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-faint)]">
                {t('nav.meinBereich')}
              </p>
              {isLoggedIn ? (
                <div className="flex flex-col gap-2">
                  {zeile(bereichHref, bereichLabel, IconArea, angeboteBadge)}
                  {userLabel && (
                    <p className="truncate px-4 text-sm text-[var(--color-muted)]" title={userLabel}>
                      {userLabel}
                    </p>
                  )}
                  <div onClick={() => setOpen(false)} className="px-1">
                    <LogoutButton locale={locale} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 px-1">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-line)] px-4 text-base font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-line)]"
                  >
                    {t('login.anmelden')}
                  </Link>
                  <Link
                    href="/registrieren"
                    onClick={() => setOpen(false)}
                    className="btn btn-accent min-h-12 text-base"
                  >
                    {t('login.jetztRegistrieren')}
                  </Link>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between px-4">
                <span className="text-sm text-[var(--color-muted)]">{t('nav.sprache')}</span>
                <LocaleSwitcher locale={locale} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bottom-Tab-Bar (nur Telefon < 768px): die wichtigsten Ziele per Daumen. ──
// Top-Level-Ziele, Icon + kurzes Label, Aktiv-Zustand, Safe-Area unten.
export function BottomNav({ bereichHref, angeboteBadge }: { bereichHref: string; angeboteBadge: number }) {
  const t = useTranslations()
  const pathname = usePathname()
  const tabs: { href: string; label: string; Icon: (p: IconProps) => ReactElement; badge?: number }[] = [
    { href: '/', label: t('nav.tabStart'), Icon: IconHome },
    { href: '/markt', label: t('nav.tabFinden'), Icon: IconSearch },
    { href: '/lotse', label: t('nav.tabLotse'), Icon: IconChat },
    { href: bereichHref, label: t('nav.tabBereich'), Icon: IconArea, badge: angeboteBadge },
  ]
  return (
    <nav
      aria-label={t('nav.navigation')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map(({ href, label, Icon, badge }) => {
          const aktiv = istAktiv(pathname, href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={aktiv ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-center transition-colors ${
                  aktiv ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'
                }`}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" />
                  {badge && badge > 0 ? (
                    <span
                      className="absolute -right-2 -top-1 min-w-4 rounded-full bg-[var(--color-accent-strong)] px-1 text-[10px] font-bold leading-4 text-white"
                      aria-label={`${badge} neue Angebote`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-medium leading-none">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
