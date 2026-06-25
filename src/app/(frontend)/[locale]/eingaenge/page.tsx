import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { listeBedarfeFuerDienst, listeVergebenFuerDienst } from '@/server/marketplace/service'
import { requireDienstSeite } from '@/server/auth/page'
import { EingaengeClient } from './EingaengeClient'

// Liest zur Laufzeit aus der DB — nicht statisch vorrendern.
export const dynamic = 'force-dynamic'

// Dienst-Seite: eingehende anonyme Bedarfe + gewonnene Bedarfe mit Kontakt.
export default async function EingaengePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireDienstSeite(locale)
  if (!user.tenantId) redirect(`/${locale}/login`)
  const TENANT = user.tenantId
  const t = await getTranslations('markt')

  const [offene, gewonnen] = await Promise.all([
    listeBedarfeFuerDienst(TENANT),
    listeVergebenFuerDienst(TENANT),
  ])

  return (
    <main className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{t('dienstTitel')}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{t('dienstSubtitle')}</p>
      <EingaengeClient
        tenantId={TENANT}
        offene={offene.map((b) => ({
          pseudonymId: b.pseudonymId,
          pflegegrad: b.pflegegrad,
          qualifikation: b.qualifikation,
          zeitfenster: b.zeitfenster,
          dauerMin: b.dauerMin,
          express: b.express,
          status: b.status,
        }))}
        gewonnen={gewonnen.map((b) => ({ pseudonymId: b.pseudonymId }))}
      />
    </main>
  )
}
