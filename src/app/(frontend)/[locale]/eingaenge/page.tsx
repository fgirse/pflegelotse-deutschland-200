import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listeBedarfeFuerDienst, listeVergebenFuerDienst } from '@/server/marketplace/service'
import { berechneFitScore } from '@/server/matching/service'
import { abgeleitetesZeitfenster, geschaetzteEinsatzdauer } from '@/shared/tourableitung'
import { ladeTouren } from '@/server/repo'
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
  const TENANT = user.tenantId
  const t = await getTranslations('markt')

  const [offene, gewonnen, touren] = await Promise.all([
    listeBedarfeFuerDienst(TENANT),
    listeVergebenFuerDienst(TENANT),
    ladeTouren(TENANT),
  ])

  // Fit-Vorschau: je offenem Bedarf den besten Tour-Slot bestimmen (Mehrweg,
  // Position). Läuft serverseitig — die Geo des Bedarfs bleibt im Server.
  const offeneMitFit = await Promise.all(
    offene.map(async (b) => {
      // Zeitfenster + Dauer aus dem neuen Bedarfsmodell ableiten (Leistungen/
      // Häufigkeit/Abwesenheiten); Fallback auf die gespeicherten Werte.
      const zeitfenster = b.leistungsauswahl
        ? abgeleitetesZeitfenster(b.leistungsauswahl, b.abwesenheiten)
        : b.zeitfenster
      const dauerMin = b.leistungsauswahl ? geschaetzteEinsatzdauer(b.leistungsauswahl) : b.dauerMin
      const { matches } = await berechneFitScore(touren, {
        geo: b.geo,
        zeitfenster,
        dauerMin,
        qualifikation: b.qualifikation,
      })
      const best = matches[0]
      return {
        pseudonymId: b.pseudonymId,
        pflegegrad: b.pflegegrad,
        qualifikation: b.qualifikation,
        kostentraegerArt: b.kostentraegerArt,
        krankenversicherer: b.krankenversicherer,
        alter: b.alter,
        wohnsituation: b.wohnsituation,
        stadtteil: b.stadtteil,
        startDatum: b.startDatum,
        abwesenheiten: b.abwesenheiten,
        besonderheiten: b.besonderheiten,
        leistungsauswahl: b.leistungsauswahl,
        zeitfenster, // abgeleitet (s. o.)
        dauerMin, // abgeleitet (s. o.)
        express: b.express,
        status: b.status,
        fit: best
          ? { pflegekraftId: best.pflegekraftId, mehrwegMin: best.mehrwegMin, position: best.position }
          : null,
      }
    }),
  )

  // PKV-Bedarfe nach oben: privat wird i. d. R. höher abgerechnet (mehr Marge),
  // ist für den Dienst also attraktiver. Stabile Sortierung — innerhalb der
  // Gruppen bleibt die bestehende Reihenfolge erhalten.
  offeneMitFit.sort(
    (a, b) => Number(b.kostentraegerArt === 'privat') - Number(a.kostentraegerArt === 'privat'),
  )

  return (
    <main className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{t('dienstTitel')}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{t('dienstSubtitle')}</p>
      <EingaengeClient
        tenantId={TENANT}
        offene={offeneMitFit}
        gewonnen={gewonnen.map((b) => ({
          pseudonymId: b.pseudonymId,
          uebernommen: Boolean(b.uebernommenAt),
        }))}
      />
    </main>
  )
}
