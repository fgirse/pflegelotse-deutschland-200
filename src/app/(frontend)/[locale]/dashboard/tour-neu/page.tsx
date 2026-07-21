import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { requireDienstSeite } from '@/server/auth/page'
import { TourNeuForm } from './TourNeuForm'

// Eigene Seite zum Anlegen einer neuen Tour (Datum, Pflegekraft, Depot, Start).
// Läuft dynamisch (Auth + Mandant zur Laufzeit).
export const dynamic = 'force-dynamic'

export default async function TourNeuPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  // Auth + 2FA + Mandant wie das Dashboard.
  await requireDienstSeite(locale)
  const t = await getTranslations('tourNeu')

  return (
    <main className="container-page max-w-xl py-8">
      <header className="mb-6">
        <Link href="/dashboard" className="text-sm text-[var(--color-accent)] hover:underline">
          ← {t('zurueck')}
        </Link>
        <h1 className="mt-3 text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <TourNeuForm />
    </main>
  )
}
