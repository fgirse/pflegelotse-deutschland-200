import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireDienstSeite } from '@/server/auth/page'
import { DienstShell } from '../DienstShell'
import { RoutingHinweis } from '../RoutingHinweis'
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
  const user = await requireDienstSeite(locale)
  const t = await getTranslations('berichte')

  return (
    <DienstShell role={user.role} active="berichte">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      {/* Kilometernachweis und Auslastung hängen an echten Straßendaten. */}
      <RoutingHinweis />
      <BerichteClient />
    </DienstShell>
  )
}
