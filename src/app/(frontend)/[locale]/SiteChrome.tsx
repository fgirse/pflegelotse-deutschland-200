import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LocaleSwitcher } from './LocaleSwitcher'

// Wortmarke: „Pflege" in Tinte, „Lotse" im Gold-Akzent — ruhige, eigenständige
// Marke statt generischem Logo.
function Wordmark() {
  return (
    <Link href="/" className="font-display text-lg font-bold tracking-tight">
      <span className="text-[var(--color-ink)]">Pflege</span>
      <span className="text-[var(--color-accent)]">Lotse</span>
    </Link>
  )
}

export function SiteHeader({ locale }: { locale: string }) {
  const t = useTranslations()
  const nav = [
    { href: '/lotse', label: t('lotse.title') },
    { href: '/tools', label: t('tools.title') },
    { href: '/dashboard', label: t('nav.dashboard') },
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-paper)]/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav aria-label="Hauptnavigation" className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          <Link
            href="/registrieren"
            className="hidden text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] sm:inline"
          >
            {t('login.jetztRegistrieren')}
          </Link>
          <Link href="/markt" className="btn btn-accent hidden sm:inline-flex">
            {t('markt.title')}
          </Link>
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  const t = useTranslations()
  return (
    <footer className="mt-20 border-t border-[var(--color-line)]">
      <div className="container-page flex flex-col gap-4 py-10 text-sm text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold">
            <span className="text-[var(--color-ink)]">Pflege</span>
            <span className="text-[var(--color-accent)]">Lotse</span>
          </span>
          <span className="text-[var(--color-faint)]">· {t('app.tagline')}</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/markt" className="hover:text-[var(--color-ink)]">
            {t('markt.title')}
          </Link>
          <Link href="/tools" className="hover:text-[var(--color-ink)]">
            {t('tools.title')}
          </Link>
          <Link href="/praevention" className="hover:text-[var(--color-ink)]">
            {t('praevention.title')}
          </Link>
          <Link href="/login" className="hover:text-[var(--color-ink)]">
            {t('login.title')}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
