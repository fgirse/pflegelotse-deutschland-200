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

// Summiert die Streckenlängen einer Tour aus einer Distanz-Matrix (echte
// Straßen-km, sofern der Provider sie liefert). Punkte: [start(0), 1..n Einsätze,
// optional ende]; Rückweg vom letzten Stopp zum Endpunkt (endeIdx = 0 = Depot).
export function summeKm(distanz: number[][], anzahlEinsaetze: number, endeIdx: number): number {
  let km = 0
  for (let i = 0; i < anzahlEinsaetze; i++) km += distanz[i][i + 1]
  km += distanz[anzahlEinsaetze][endeIdx]
  return Math.round(km * 10) / 10
}
