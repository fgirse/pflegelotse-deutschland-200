import type { Metadata, Viewport } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireDienstSeite } from '@/server/auth/page'
import { ErfassungPwa } from './ErfassungPwa'
import { PwaRegister } from './PwaRegister'

// Mobile Leistungserfassung als PWA (§5.3). Läuft dynamisch (Auth + Mandant);
// die Tagesdaten holt der Client selbst (offline-first via IndexedDB).
export const dynamic = 'force-dynamic'

// Manifest + Theme für die installierbare PWA.
export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Erfassung', statusBarStyle: 'default' },
}
export const viewport: Viewport = { themeColor: '#b45309' }

export default async function ErfassungPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireDienstSeite(locale)
  const t = await getTranslations('erfassung')

  return (
    <main className="container-page max-w-md py-6">
      <PwaRegister />
      <header className="mb-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <ErfassungPwa />
    </main>
  )
}
