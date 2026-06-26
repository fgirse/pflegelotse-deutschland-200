import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { Link } from '@/i18n/navigation'
import { getAuthUser } from '@/server/auth/guard'
import { LocaleSwitcher } from './LocaleSwitcher'
import { LogoutButton } from './LogoutButton'

const DIENST_ROLLEN = ['disponent', 'admin', 'pflegekraft']

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

// Serverseitig gerenderter Header: der Anmeldestatus ist sofort im ersten
// HTML sichtbar (kein Client-Flash). Liest die Sitzung aus dem Cookie —
// dadurch werden die Seiten dynamisch gerendert.
export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations()
  // headers() BEWUSST außerhalb des try/catch: der Aufruf signalisiert Next das
  // dynamische Rendering (Bailout). Würde der catch ihn schlucken, prerenderte
  // Next die Seite statisch und der Status käme nie aus dem echten Cookie.
  const h = await headers()
  let user = null
  try {
    user = await getAuthUser(h)
  } catch {
    user = null // nur Auth-/DB-Fehler abfangen, nicht den Dynamic-Bailout.
  }

  const nav = [
    { href: '/lotse', label: t('lotse.title') },
    { href: '/tools', label: t('tools.title') },
  ]
  const istDienst = user ? DIENST_ROLLEN.includes(user.role) : false
  const bereichHref = istDienst ? '/dashboard' : '/meine-bedarfe'
  const bereichLabel = istDienst ? t('nav.dashboard') : t('meineBedarfe.title')

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
          {user ? (
            <>
              <Link href={bereichHref} className="btn btn-outline">
                {bereichLabel}
              </Link>
              <span
                className="hidden max-w-[12rem] truncate text-sm text-[var(--color-muted)] md:inline"
                title={user.email}
              >
                {user.dienstName || user.email}
              </span>
              <LogoutButton locale={locale} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                {t('login.anmelden')}
              </Link>
              <Link href="/registrieren" className="btn btn-accent">
                {t('login.jetztRegistrieren')}
              </Link>
            </>
          )}
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
          <Link href="/impressum" className="hover:text-[var(--color-ink)]">
            {t('nav.impressum')}
          </Link>
          <Link href="/datenschutz" className="hover:text-[var(--color-ink)]">
            {t('nav.datenschutz')}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
