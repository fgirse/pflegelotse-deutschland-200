import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { requireAngehoerige } from '@/server/auth/page'
import { listeBedarfeFuerNutzer } from '@/server/marketplace/service'
import { MeineBedarfeListe } from './MeineBedarfeListe'

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

  // Datumsangaben serverseitig formatieren (vermeidet Hydration-Probleme).
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  })
  const datum = (iso?: string) => (iso ? fmt.format(new Date(iso)) : undefined)
  const portal = eintraege.map(({ bedarf, anzahlAngebote }) => ({
    pseudonymId: bedarf.pseudonymId,
    status: bedarf.status,
    express: bedarf.express,
    pflegegrad: bedarf.pflegegrad,
    zeitfensterVon: bedarf.zeitfenster.von,
    zeitfensterBis: bedarf.zeitfenster.bis,
    dauerMin: bedarf.dauerMin,
    qualifikation: bedarf.qualifikation,
    leistungen: bedarf.leistungen,
    kostentraegerArt: bedarf.kostentraegerArt,
    krankenversicherer: bedarf.krankenversicherer,
    anzahlAngebote,
    eingestellt: datum(bedarf.createdAt),
    ersteReaktion: datum(bedarf.firstResponseAt),
    frist: datum(bedarf.deadlineAt),
  }))

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
        <MeineBedarfeListe eintraege={portal} />
      )}
    </main>
  )
}
