import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { requireDienstSeite } from '@/server/auth/page'
import { ladeKatalog } from '@/server/leistungen/service'
import { LeistungenVerwaltung } from './LeistungenVerwaltung'

// Leistungskatalog-Verwaltung. Lädt (und befüllt beim ersten Mal) zur Laufzeit.
export const dynamic = 'force-dynamic'

export default async function LeistungenPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireDienstSeite(locale)
  // Katalog pflegen Disponent und Inhaber (nicht die Pflegekraft).
  if (user.role !== 'admin' && user.role !== 'disponent') redirect(`/${locale}/dashboard`)

  const t = await getTranslations('leistungen')
  const katalog = await ladeKatalog(user.tenantId)

  return (
    <main className="container-page max-w-4xl py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <LeistungenVerwaltung anfang={katalog} />
    </main>
  )
}
