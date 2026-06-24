import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { requireDienstSeite } from '@/server/auth/page'
import { ladeKlientenOperativ } from '@/server/repo'
import { HANDLUNGSFELDER } from '@/server/praevention/katalog'
import { PraeventionClient } from './PraeventionClient'

export const dynamic = 'force-dynamic'

// Präventionsmodul (/F900/) — geschützte Dienst-Seite (Pflegekraft/Disponent).
export default async function PraeventionPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireDienstSeite(locale)
  if (!user.tenantId) redirect(`/${locale}/login`)
  const t = await getTranslations('praevention')

  const klienten = await ladeKlientenOperativ(user.tenantId, 'aktiv')

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-slate-600">{t('subtitle')}</p>
      <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{t('hinweis')}</p>
      <PraeventionClient
        felder={HANDLUNGSFELDER}
        klienten={klienten.map((k) => ({
          pseudonymId: k.pseudonymId,
          pflegegrad: k.pflegegrad,
        }))}
      />
    </main>
  )
}
