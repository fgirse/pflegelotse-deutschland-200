import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { requireDienstSeite } from '@/server/auth/page'
import { erzeugeNachweisDokument } from '@/server/nachweis/service'
import { NachweisView } from './NachweisView'

// Druckbarer, rechtssicherer Leistungsnachweis (§5.4). Verbindet die pseudonymen
// Säule-2-Einträge mit der Identität aus Säule 1 (nur zur Darstellung).
export const dynamic = 'force-dynamic'

export default async function NachweisPage({
  params,
}: {
  params: Promise<{ locale: string; pseudonymId: string }>
}) {
  const { locale, pseudonymId } = await params
  setRequestLocale(locale)
  const user = await requireDienstSeite(locale)
  const t = await getTranslations('nachweis')
  const doc = await erzeugeNachweisDokument(user.tenantId, pseudonymId)

  return (
    <main className="container-page max-w-2xl py-8">
      <div className="mb-4 print:hidden">
        <Link href="/dashboard" className="text-sm text-[var(--color-accent)] hover:underline">
          ← {t('zurueck')}
        </Link>
      </div>
      {doc ? (
        <NachweisView doc={doc} />
      ) : (
        <p className="text-sm text-[var(--color-muted)]">{t('keine')}</p>
      )}
    </main>
  )
}
