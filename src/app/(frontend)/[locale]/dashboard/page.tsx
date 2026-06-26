import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ladeTouren, ladeKlientenOperativ } from '@/server/repo'
import { planeTour } from '@/server/matching/service'
import { listeBedarfeFuerDienst } from '@/server/marketplace/service'
import { requireDienstSeite } from '@/server/auth/page'
import { DashboardClient } from './DashboardClient'

// Das Dashboard liest zur Laufzeit aus der Datenbank (Säule 2) — es darf
// nicht statisch vorgerendert werden.
export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  // Auth + 2FA + Mandant erzwingen; Mandant aus dem Nutzer ableiten.
  const user = await requireDienstSeite(locale)
  const TENANT = user.tenantId
  const t = await getTranslations('dashboard')

  const eingaenge = await listeBedarfeFuerDienst(TENANT)

  const [touren, klienten] = await Promise.all([
    ladeTouren(TENANT),
    ladeKlientenOperativ(TENANT, 'aktiv'),
  ])

  // Kennzahlen je Tour vorab berechnen (Fahrzeit, Auslastung).
  const tourenMitKennzahlen = await Promise.all(
    touren.map(async (tour) => {
      const plan = await planeTour(tour)
      return {
        tour: { ...tour, einsaetze: plan.einsaetze },
        fahrzeitMin: plan.fahrzeitMin,
        auslastungProzent: plan.auslastungProzent,
      }
    }),
  )

  // Kandidaten = aktive Klienten, die in keiner Tour eingeplant sind.
  const zugeordnet = new Set(
    touren.flatMap((tr) => tr.einsaetze.map((e) => e.pseudonymId)),
  )
  const kandidaten = klienten.filter((k) => !zugeordnet.has(k.pseudonymId))

  const tl = await getTranslations('login')

  return (
    <main className="container-page max-w-7xl py-8">
      <header className="mb-6">
        <span className="chip">
          {tl('angemeldetAls')}: {user.dienstName || user.email}
        </span>
        <h1 className="mt-3 text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>

      {/* Marktplatz-Eingänge sichtbar machen + Einzugsgebiet pflegen. */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <Link href="/eingaenge" className="tile flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg font-semibold">{t('eingaengeTitel')}</div>
            <div className="text-sm text-[var(--color-muted)]">
              {t('eingaengeAnzahl', { n: eingaenge.length })}
            </div>
          </div>
          <span className="chip">{eingaenge.length}</span>
        </Link>
        <Link href="/dienst/einzugsgebiet" className="tile flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg font-semibold">{t('einzugsgebietTitel')}</div>
            <div className="text-sm text-[var(--color-muted)]">{t('einzugsgebietHinweis')}</div>
          </div>
          <span aria-hidden>→</span>
        </Link>
      </section>

      <DashboardClient
        tenantId={TENANT}
        tours={tourenMitKennzahlen}
        candidates={kandidaten}
      />
    </main>
  )
}
