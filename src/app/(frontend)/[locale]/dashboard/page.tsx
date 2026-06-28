import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ladeTouren, ladeKlientenOperativ } from '@/server/repo'
import { planeTour, berechneFitScore } from '@/server/matching/service'
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

  // Fit je offenem Bedarf (bester Slot) — für die Kachel-Zusammenfassung.
  const eingaengeFit = await Promise.all(
    eingaenge.map((b) =>
      berechneFitScore(touren, {
        geo: b.geo,
        zeitfenster: b.zeitfenster,
        dauerMin: b.dauerMin,
        qualifikation: b.qualifikation,
      }).then((r) => r.matches[0] ?? null),
    ),
  )
  const passend = eingaengeFit.filter(Boolean).length
  const ohneUmweg = eingaengeFit.filter((m) => m && m.mehrwegMin === 0).length

  // PKV/GKV-Verteilung der offenen Bedarfe — Margen-Mix der Gelegenheiten.
  const kvMix = { privat: 0, gesetzlich: 0, ohne: 0 }
  for (const b of eingaenge) {
    if (b.kostentraegerArt === 'privat') kvMix.privat++
    else if (b.kostentraegerArt === 'gesetzlich') kvMix.gesetzlich++
    else kvMix.ohne++
  }
  const kvGesamt = eingaenge.length
  const pct = (n: number) => (kvGesamt > 0 ? Math.round((n / kvGesamt) * 100) : 0)

  // Offene Bedarfe (noch in keiner Tour) als einplanbare Marktplatz-Kandidaten.
  const bedarfeKandidaten = eingaenge
    .filter((b) => !zugeordnet.has(b.pseudonymId))
    .map((b) => ({
      pseudonymId: b.pseudonymId,
      geo: b.geo,
      zeitfenster: b.zeitfenster,
      dauerMin: b.dauerMin,
      qualifikation: b.qualifikation,
      pflegegrad: b.pflegegrad,
      quelle: 'bedarf' as const,
    }))

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

      {/* Marktplatz-Eingänge sichtbar machen + Einzugsgebiet/Import. */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/eingaenge" className="tile flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg font-semibold">{t('eingaengeTitel')}</div>
            <div className="text-sm text-[var(--color-muted)]">
              {t('eingaengeAnzahl', { n: eingaenge.length })}
            </div>
            {eingaenge.length > 0 && (
              <div className="mt-1 text-sm font-medium text-[var(--color-success)]">
                {t('eingaengeFit', { passend, ohneUmweg })}
              </div>
            )}
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
        <Link href="/dienst/import" className="tile flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg font-semibold">{t('importTitel')}</div>
            <div className="text-sm text-[var(--color-muted)]">{t('importHinweis')}</div>
          </div>
          <span aria-hidden>→</span>
        </Link>
      </section>

      {/* Kostenträger-Mix der offenen Bedarfe — PKV (höhere Marge) hervorgehoben. */}
      <section className="card mb-6 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{t('kvMixTitel')}</h2>
          <span className="text-sm text-[var(--color-muted)]">{t('kvMixGesamt', { n: kvGesamt })}</span>
        </div>
        {kvGesamt === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-faint)]">{t('kvMixLeer')}</p>
        ) : (
          <>
            {/* Gestapelter Balken: privat | gesetzlich | ohne Angabe. */}
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--color-line)]">
              <div className="bg-[var(--color-accent-strong)]" style={{ width: `${pct(kvMix.privat)}%` }} />
              <div className="bg-[var(--color-accent)]" style={{ width: `${pct(kvMix.gesetzlich)}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-accent-strong)]" />
                {t('kvPrivat')}: <strong>{kvMix.privat}</strong> ({pct(kvMix.privat)}%)
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-accent)]" />
                {t('kvGesetzlich')}: <strong>{kvMix.gesetzlich}</strong> ({pct(kvMix.gesetzlich)}%)
              </span>
              {kvMix.ohne > 0 && (
                <span className="flex items-center gap-2 text-[var(--color-muted)]">
                  <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-line)]" />
                  {t('kvOhne')}: <strong>{kvMix.ohne}</strong> ({pct(kvMix.ohne)}%)
                </span>
              )}
            </div>
          </>
        )}
      </section>

      <DashboardClient
        tenantId={TENANT}
        tours={tourenMitKennzahlen}
        candidates={kandidaten}
        bedarfe={bedarfeKandidaten}
      />
    </main>
  )
}
