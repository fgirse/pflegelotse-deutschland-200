import type { Tour } from '@/shared/domain'
import { haversineKm } from '@/server/routing/HaversineRoutingProvider'

// Geometrische Kilometer-Schätzung einer Tour (§5.4 Kilometernachweis):
// Luftlinie zwischen aufeinanderfolgenden Stopps × Umwegfaktor, inkl. Rückweg
// zum Endpunkt (Depot, sofern kein separates `ende`). Bewusst eine Schätzung —
// echte Straßen-km bräuchten eine Distanzmatrix vom Routing-Provider.
export const UMWEG_FAKTOR = 1.3

export function tourKilometer(tour: Tour): number {
  const punkte = [tour.start, ...tour.einsaetze.map((e) => e.geo), tour.ende ?? tour.start]
  let km = 0
  for (let i = 1; i < punkte.length; i++) km += haversineKm(punkte[i - 1], punkte[i])
  return Math.round(km * UMWEG_FAKTOR * 10) / 10
}
