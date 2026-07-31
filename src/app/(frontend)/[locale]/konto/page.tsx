import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireAngemeldet } from '@/server/auth/page'
import { KontoForm } from './KontoForm'

// Konto-Seite (Passwortwechsel): jede angemeldete Rolle, kein 2FA-Zwang.
export const dynamic = 'force-dynamic'

// Rollenpassendes Ziel nach erzwungenem Wechsel (wie in der LoginForm).
function zielFuer(role: string, locale: string) {
  return role === 'pflegekraft'
    ? `/${locale}/erfassung`
    : role === 'angehoeriger'
      ? `/${locale}/meine-bedarfe`
      : `/${locale}/dashboard`
}

export default async function KontoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ pflicht?: string }>
}) {
  const { locale } = await params
  const { pflicht } = await searchParams
  setRequestLocale(locale)
  const user = await requireAngemeldet(locale)
  const t = await getTranslations('konto')
  const istPflicht = pflicht === '1'

  return (
    <main className="container-page max-w-md py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <KontoForm pflicht={istPflicht} weiterZu={istPflicht ? zielFuer(user.role, locale) : null} />
    </main>
  )
}
