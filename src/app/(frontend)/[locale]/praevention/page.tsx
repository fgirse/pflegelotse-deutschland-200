import { setRequestLocale, getTranslations } from 'next-intl/server'
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
  const t = await getTranslations('praevention')

  const klienten = await ladeKlientenOperativ(user.tenantId, 'aktiv')

  return (
    <main className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      <p className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-accent)]">
        {t('hinweis')}
      </p>
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
