import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { Link } from '@/i18n/navigation'
import { getAuthUser } from '@/server/auth/guard'
import { zaehleOffeneAngebote } from '@/server/marketplace/service'
import { LocaleSwitcher } from './LocaleSwitcher'
import { LogoutButton } from './LogoutButton'
import { DesktopNav, MobileMenu } from './SiteNav'

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

  const istDienst = user ? DIENST_ROLLEN.includes(user.role) : false
  const bereichHref = istDienst ? '/dashboard' : '/meine-bedarfe'
  const bereichLabel = istDienst ? t('nav.dashboard') : t('meineBedarfe.title')

  // In-App-Hinweis für Suchende: Anzahl Bedarfe mit neuen/offenen Angeboten.
  let angeboteBadge = 0
  if (user && !istDienst) {
    try {
      angeboteBadge = await zaehleOffeneAngebote(user.id)
    } catch {
      angeboteBadge = 0
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-paper)]/85 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Wordmark />
        {/* Inline-Navigation ab 1024px (mit Aktiv-Zustand). */}
        <DesktopNav />

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Desktop-Aktionen ab 1024px. */}
          <div className="hidden items-center gap-3 lg:flex">
            <LocaleSwitcher locale={locale} />
            {user ? (
              <>
                <Link href={bereichHref} className="btn btn-outline min-h-11">
                  {bereichLabel}
                  {angeboteBadge > 0 && (
                    <span
                      className="ml-1.5 rounded-full bg-[var(--color-accent-strong)] px-1.5 text-xs font-bold text-white"
                      aria-label={`${angeboteBadge} neue Angebote`}
                    >
                      {angeboteBadge}
                    </span>
                  )}
                </Link>
                <span
                  className="max-w-[12rem] truncate text-sm text-[var(--color-muted)]"
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
                  className="flex min-h-11 items-center rounded-lg border border-[var(--color-line)] px-3 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-line)]"
                >
                  {t('login.anmelden')}
                </Link>
                <Link href="/registrieren" className="btn btn-accent min-h-11">
                  {t('login.jetztRegistrieren')}
                </Link>
              </>
            )}
          </div>

          {/* Mobiles/Tablet-Menü unter 1024px. */}
          <MobileMenu
            locale={locale}
            isLoggedIn={!!user}
            bereichHref={bereichHref}
            bereichLabel={bereichLabel}
            userLabel={user ? user.dienstName || user.email : ''}
            angeboteBadge={angeboteBadge}
          />
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
