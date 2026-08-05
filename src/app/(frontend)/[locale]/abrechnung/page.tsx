import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireDienstSeite } from '@/server/auth/page'
import { DienstShell } from '../DienstShell'
import { AbrechnungClient } from './AbrechnungClient'

// Abrechnungs-Exporte (§8.3): DATEV-EXTF-Buchungsstapel + abrechnungsvorbereitendes
// Kassen-CSV, jeweils für einen Zeitraum. Geschützt (Auth + Mandant).
export const dynamic = 'force-dynamic'

export default async function AbrechnungPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireDienstSeite(locale)
  const t = await getTranslations('abrechnung')

  return (
    <DienstShell role={user.role} active="abrechnung">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <AbrechnungClient />
    </DienstShell>
  )
}
