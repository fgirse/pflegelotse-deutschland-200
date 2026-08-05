import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { requireDienstSeite } from '@/server/auth/page'
import { DienstShell } from '../../DienstShell'
import { ladeKlientenListe } from '@/server/klienten/liste'
import { ladeKatalogAuswahl } from '@/server/leistungen/service'
import kassenListe from '@/shared/data/krankenkassen-gesetzlich.json'
import { KlientenTabelle } from './KlientenTabelle'

// Klientenliste (Stammdaten): führt Identität (Säule 1) und operative Merkmale
// (Säule 2) zusammen; Zeilen sind bearbeitbar. Kein statisches Prerendering.
export const dynamic = 'force-dynamic'

export default async function KlientenPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireDienstSeite(locale)
  if (user.role !== 'admin' && user.role !== 'disponent') redirect(`/${locale}/dashboard`)

  const t = await getTranslations('klienten')
  const [klienten, katalog] = await Promise.all([
    ladeKlientenListe(user.tenantId),
    ladeKatalogAuswahl(user.tenantId),
  ])
  // Nur die Kassennamen ans Frontend (Dropdown bei gesetzlich Versicherten).
  const kassen = (kassenListe as { name: string }[]).map((k) => k.name)

  return (
    <DienstShell role={user.role} active="klienten">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-[var(--color-muted)]">{t('subtitle', { n: klienten.length })}</p>
        </div>
        <Link href="/dienst/import" className="btn btn-outline">
          {t('importLink')}
        </Link>
      </header>
      <KlientenTabelle anfang={klienten} kassen={kassen} katalog={katalog} />
    </DienstShell>
  )
}
