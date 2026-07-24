import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ladeTouren, ladeKlientenOperativ } from '@/server/repo'
import { planeTour, berechneFitScore } from '@/server/matching/service'
import { listeBedarfeFuerDienst } from '@/server/marketplace/service'
import { requireDienstSeite } from '@/server/auth/page'
import { DashboardClient } from './DashboardClient'
import { DashboardImport } from './DashboardImport'
import { WochenplanButton } from './WochenplanButton'

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
        arbeitszeitMin: plan.arbeitszeitMin,
        arbzgKonform: plan.arbzgKonform,
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

  // PKV/GKV-Margen-Mix: einmal über die offenen Bedarfe (Gelegenheiten), einmal
  // über den aktiven Klientenstamm (bestehendes Portfolio).
  const kvBedarfe = zaehleKv(eingaenge)
  const kvStamm = zaehleKv(klienten)
  const kvLabels = { privat: t('kvPrivat'), gesetzlich: t('kvGesetzlich'), ohne: t('kvOhne') }

  // Klientenstamm zusätzlich nach Pflegegrad — Pflegeintensität des Portfolios.
  const pgZahlen = zaehlePflegegrad(klienten)
  const pgRows = [1, 2, 3, 4, 5].map((g) => ({ label: t('pgRow', { n: g }), count: pgZahlen[g] }))
  if (pgZahlen.ohne > 0) pgRows.push({ label: t('kvOhne'), count: pgZahlen.ohne })

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
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="chip">
            {tl('angemeldetAls')}: {user.dienstName || user.email}
          </span>
          <h1 className="mt-3 text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-[var(--color-muted)]">{t('subtitle')}</p>
        </div>
        {/* Primäraktion: neue Tour anlegen. */}
        <Link href="/dashboard/tour-neu" className="btn btn-primary shrink-0">
          + {t('tourErstellen')}
        </Link>
      </header>

      {/* Marktplatz-Eingänge + Einzugsgebiet. */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2">
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
      </section>

      {/* Prominenter CSV/Excel-Upload (Drag & Drop) — Klienten aus der Pflegesoftware. */}
      <DashboardImport />

      {/* Wochenplanung: Rahmenplan aus den Stammtouren erzeugen (§5.2.2). */}
      <WochenplanButton />

      {/* Kostenträger-Mix: offene Bedarfe (Gelegenheiten) + Klientenstamm (Portfolio). */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <KvMixCard
          titel={t('kvMixTitel')}
          gesamtText={t('kvMixGesamt', { n: eingaenge.length })}
          leerText={t('kvMixLeer')}
          mix={kvBedarfe}
          labels={kvLabels}
        />
        <KvMixCard
          titel={t('kvStammTitel')}
          gesamtText={t('kvStammGesamt', { n: klienten.length })}
          leerText={t('kvStammLeer')}
          mix={kvStamm}
          labels={kvLabels}
        />
      </div>

      {/* Klientenstamm nach Pflegegrad. */}
      <div className="mb-6">
        <PflegegradCard
          titel={t('pgTitel')}
          gesamtText={t('kvStammGesamt', { n: klienten.length })}
          leerText={t('kvStammLeer')}
          rows={pgRows}
        />
      </div>

      <DashboardClient
        tenantId={TENANT}
        tours={tourenMitKennzahlen}
        candidates={kandidaten}
        bedarfe={bedarfeKandidaten}
      />
    </main>
  )
}

// Zählt Klienten je Pflegegrad (1–5) plus „ohne Angabe".
function zaehlePflegegrad(items: { pflegegrad?: number }[]): Record<string, number> {
  const m: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ohne: 0 }
  for (const it of items) {
    const g = it.pflegegrad
    if (g && g >= 1 && g <= 5) m[g]++
    else m.ohne++
  }
  return m
}

// Zählt Einträge je Kostenträger-Art (privat/gesetzlich/ohne Angabe).
function zaehleKv(items: { kostentraegerArt?: 'gesetzlich' | 'privat' }[]) {
  const m = { privat: 0, gesetzlich: 0, ohne: 0 }
  for (const it of items) {
    if (it.kostentraegerArt === 'privat') m.privat++
    else if (it.kostentraegerArt === 'gesetzlich') m.gesetzlich++
    else m.ohne++
  }
  return m
}

// Karte: horizontale Mini-Balken je Pflegegrad. Balkenbreite = Anteil am Stamm.
function PflegegradCard({
  titel,
  gesamtText,
  leerText,
  rows,
}: {
  titel: string
  gesamtText: string
  leerText: string
  rows: { label: string; count: number }[]
}) {
  const total = rows.reduce((s, r) => s + r.count, 0)
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{titel}</h2>
        <span className="text-sm text-[var(--color-muted)]">{gesamtText}</span>
      </div>
      {total === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-faint)]">{leerText}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm text-[var(--color-muted)]">{r.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
                <div className="h-full bg-[var(--color-accent)]" style={{ width: `${pct(r.count)}%` }} />
              </div>
              <span className="w-20 shrink-0 text-right text-sm">
                <strong>{r.count}</strong> ({pct(r.count)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

type KvMix = { privat: number; gesetzlich: number; ohne: number }

// Karte: gestapelter Balken + Legende für eine Kostenträger-Verteilung.
// PKV (privat) ist farblich hervorgehoben (höhere Marge).
function KvMixCard({
  titel,
  gesamtText,
  leerText,
  mix,
  labels,
}: {
  titel: string
  gesamtText: string
  leerText: string
  mix: KvMix
  labels: { privat: string; gesetzlich: string; ohne: string }
}) {
  const total = mix.privat + mix.gesetzlich + mix.ohne
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{titel}</h2>
        <span className="text-sm text-[var(--color-muted)]">{gesamtText}</span>
      </div>
      {total === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-faint)]">{leerText}</p>
      ) : (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--color-line)]">
            <div className="bg-[var(--color-accent-strong)]" style={{ width: `${pct(mix.privat)}%` }} />
            <div className="bg-[var(--color-accent)]" style={{ width: `${pct(mix.gesetzlich)}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-accent-strong)]" />
              {labels.privat}: <strong>{mix.privat}</strong> ({pct(mix.privat)}%)
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-accent)]" />
              {labels.gesetzlich}: <strong>{mix.gesetzlich}</strong> ({pct(mix.gesetzlich)}%)
            </span>
            {mix.ohne > 0 && (
              <span className="flex items-center gap-2 text-[var(--color-muted)]">
                <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-line)]" />
                {labels.ohne}: <strong>{mix.ohne}</strong> ({pct(mix.ohne)}%)
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}
