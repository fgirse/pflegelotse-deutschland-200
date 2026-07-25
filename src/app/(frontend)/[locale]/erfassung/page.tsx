import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ladeTouren } from '@/server/repo'
import { requireDienstSeite } from '@/server/auth/page'
import { ErfassungClient } from './ErfassungClient'

// Mobile Leistungserfassung (§5.3): schlanke Tagestour-Ansicht für den
// Außendienst. Läuft dynamisch (Auth + Mandant zur Laufzeit).
export const dynamic = 'force-dynamic'

export default async function ErfassungPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireDienstSeite(locale)
  const t = await getTranslations('erfassung')

  // Touren des Mandanten (schlank: nur die für die Erfassung nötigen Felder).
  const touren = (await ladeTouren(user.tenantId)).map((tr) => ({
    id: tr.id,
    pflegekraftId: tr.pflegekraftId,
    datum: tr.datum,
    einsaetze: tr.einsaetze.map((e) => ({
      pseudonymId: e.pseudonymId,
      zeitfenster: e.zeitfenster,
      istAnkunft: e.istAnkunft ?? null,
      erledigt: Boolean(e.erledigt),
    })),
  }))

  return (
    <main className="container-page max-w-md py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <ErfassungClient touren={touren} />
    </main>
  )
}
