import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { requireAngehoerige } from '@/server/auth/page'
import { listeBedarfeFuerNutzer } from '@/server/marketplace/service'
import { minToHHMM } from '@/shared/time'

// Liest die Bedarfe des angemeldeten Suchenden — dynamisch, nicht vorrendern.
export const dynamic = 'force-dynamic'

// „Meine Bedarfe": Portal für Suchende — eingestellte Bedarfe, Status und
// Anzahl der Angebote, mit Absprung in den Angebots-Vergleich.
export default async function MeineBedarfePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireAngehoerige(locale)
  const t = await getTranslations('meineBedarfe')
  const tl = await getTranslations('login')
  const eintraege = await listeBedarfeFuerNutzer(user.id)

  return (
    <main className="container-page max-w-2xl py-10 sm:py-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1 className="mt-2 text-3xl font-bold">{t('title')}</h1>
          <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
          <p className="mt-2 text-sm text-[var(--color-faint)]">
            {tl('angemeldetAls')}: {user.email}
          </p>
        </div>
        <Link href="/markt" className="btn btn-accent shrink-0">
          {t('neuerBedarf')}
        </Link>
      </div>

      {eintraege.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-[var(--color-muted)]">{t('leer')}</p>
          <Link href="/markt" className="btn btn-primary mt-4">
            {t('neuerBedarf')}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {eintraege.map(({ bedarf, anzahlAngebote }) => (
            <li key={bedarf.pseudonymId} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">{t(`status.${bedarf.status}`)}</span>
                {bedarf.express && <span className="chip">Express</span>}
              </div>
              <div className="mt-3 text-sm text-[var(--color-muted)]">
                {bedarf.pflegegrad ? `${t('pflegegrad')} ${bedarf.pflegegrad} · ` : ''}
                {minToHHMM(bedarf.zeitfenster.von)}–{minToHHMM(bedarf.zeitfenster.bis)} · {bedarf.dauerMin}{' '}
                {t('min')}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {t('angebote', { n: anzahlAngebote })}
                </span>
                <Link href={`/markt/${bedarf.pseudonymId}`} className="btn btn-outline">
                  {t('ansehen')}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
