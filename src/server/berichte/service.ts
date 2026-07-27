import { planeTour } from '@/server/matching/service'
import { ladeTouren } from '@/server/repo'
import { tourKilometer } from './kilometer'
import { aggregiereBerichte, type Berichte, type TourKennzahl } from './aggregat'

// §5.4-Berichte für einen Zeitraum: lädt die Touren des Mandanten, rechnet je
// Tour über planeTour (an den aktiven Routing-Provider gebunden) + geometrische
// Kilometer, und aggregiert nach Pflegekraft.
export async function berechneBerichte(tenantId: string, von: string, bis: string): Promise<Berichte> {
  const touren = (await ladeTouren(tenantId)).filter((t) => t.datum >= von && t.datum <= bis)
  const kennzahlen: TourKennzahl[] = await Promise.all(
    touren.map(async (t) => {
      const p = await planeTour(t)
      return {
        pflegekraftId: t.pflegekraftId,
        datum: t.datum,
        fahrzeitMin: p.fahrzeitMin,
        arbeitszeitMin: p.arbeitszeitMin,
        amKlientenMin: p.pflegezeitMin + p.grundzeitMin,
        einsaetze: t.einsaetze.length,
        km: tourKilometer(t),
      }
    }),
  )
  return aggregiereBerichte(kennzahlen)
}
