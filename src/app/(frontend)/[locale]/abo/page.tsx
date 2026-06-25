import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { ABO_TIERS, centsZuEuro, type AboStufe } from '@/server/billing/pricing'
import { holeAboStatus } from '@/server/billing/subscription'
import { requireDienstSeite } from '@/server/auth/page'
import { AboClient } from './AboClient'

export const dynamic = 'force-dynamic'

// Dienst-Seite: SaaS-Abo abschließen (/F1030/) und Status sehen.
export default async function AboPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireDienstSeite(locale)
  if (!user.tenantId) redirect(`/${locale}/login`)
  const TENANT = user.tenantId
  const t = await getTranslations('abo')

  const status = await holeAboStatus(TENANT)
  const tiers = (Object.keys(ABO_TIERS) as AboStufe[]).map((key) => ({
    key,
    label: ABO_TIERS[key].label,
    preisText: centsZuEuro(ABO_TIERS[key].monatlichCents),
  }))

  return (
    <main className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      <AboClient tenantId={TENANT} tiers={tiers} status={status} />
    </main>
  )
}
