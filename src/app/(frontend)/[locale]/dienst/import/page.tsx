import { setRequestLocale, getTranslations } from 'next-intl/server'
import { requireDienstSeite } from '@/server/auth/page'
import { ImportClient } from './ImportClient'

export const dynamic = 'force-dynamic'

// Dienst-Seite: Klienten aus einer Export-Datei der Pflegesoftware importieren
// (CSV/Excel-Export), mit Spaltenzuordnung und Adress-Geokodierung.
export default async function ImportPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireDienstSeite(locale)
  const t = await getTranslations('import')

  return (
    <main className="container-page max-w-2xl py-10 sm:py-14">
      <span className="eyebrow">{t('eyebrow')}</span>
      <h1 className="mt-2 text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      <ImportClient />
    </main>
  )
}
