import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { requireDienstSeite } from '@/server/auth/page'
import { BerichteClient } from './BerichteClient'

// §5.4-Berichte: Mitarbeiterauslastung + Kilometernachweis für einen Zeitraum.
export const dynamic = 'force-dynamic'

export default async function BerichtePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireDienstSeite(locale)
  const t = await getTranslations('berichte')

  return (
    <main className="container-page max-w-4xl py-8">
      <header className="mb-6">
        <Link href="/dashboard" className="text-sm text-[var(--color-accent)] hover:underline">
          ← {t('zurueck')}
        </Link>
        <h1 className="mt-3 text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <BerichteClient />
    </main>
  )
}
