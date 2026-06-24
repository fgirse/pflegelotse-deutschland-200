import type { FitScoreRequest, FitMatch, Tour, Zeitfenster } from '@/shared/domain'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'

// Ein Knoten in der Tour-Simulation: Depot (ohne Fenster) oder Einsatz.
interface Knoten {
  von: number
  bis: number
  dauer: number
}

type Kandidat = FitScoreRequest['kandidat']

// Prüft, ob die Pflegekraft alle vom Kandidaten geforderten Qualifikationen hat.
function qualifikationErfuellt(tour: Tour, kandidat: Kandidat): boolean {
  const vorhanden = new Set(tour.pflegekraftQualifikation)
  return kandidat.qualifikation.every((q) => vorhanden.has(q))
}

// Simuliert eine Einsatzfolge ab dem Depot und liefert Machbarkeit,
// Gesamtfahrzeit und die Ankunftszeiten je Knoten.
// `order` enthält Matrix-Indizes; order[0] ist immer das Depot.
function simuliere(
  order: number[],
  startZeit: number,
  matrix: number[][],
  knoten: Knoten[],
): { machbar: boolean; fahrzeit: number; ankunft: number[] } {
  let t = startZeit // Abfahrt am Depot
  let fahrzeit = 0
  const ankunft = new Array(order.length).fill(0)

  for (let k = 1; k < order.length; k++) {
    const reise = matrix[order[k - 1]][order[k]]
    fahrzeit += reise
    const ank = t + reise
    ankunft[k] = ank
    const n = knoten[order[k]]
    // Wartet die Kraft, falls sie vor dem frühesten Beginn ankommt.
    const beginn = Math.max(ank, n.von)
    // Spätester Beginn überschritten → Zeitfenster verletzt.
    if (beginn > n.bis) return { machbar: false, fahrzeit, ankunft }
    t = beginn + n.dauer
  }
  return { machbar: true, fahrzeit, ankunft }
}

// Berechnet den besten (geringsten) Mehrweg, mit dem sich der Kandidat in
// EINE Tour einfügen lässt, ohne ein Zeitfenster zu verletzen. Gibt null
// zurück, wenn keine Position machbar ist oder die Qualifikation fehlt.
export async function fitScoreFuerTour(
  tour: Tour,
  kandidat: Kandidat,
  routing: RoutingProvider,
): Promise<FitMatch | null> {
  // Harte Bedingung 1: Qualifikation. Fehlt sie, ist keine Position möglich.
  if (!qualifikationErfuellt(tour, kandidat)) return null

  const n = tour.einsaetze.length
  // Punkt- und Knotenliste: 0=Depot, 1..n=Einsätze, n+1=Kandidat.
  const punkte = [
    tour.start,
    ...tour.einsaetze.map((e) => e.geo),
    kandidat.geo,
  ]
  const knoten: Knoten[] = [
    { von: 0, bis: 1439, dauer: 0 }, // Depot ohne Fenster
    ...tour.einsaetze.map((e) => fensterKnoten(e.zeitfenster, e.dauerMin)),
    fensterKnoten(kandidat.zeitfenster, kandidat.dauerMin),
  ]
  const kandidatIdx = n + 1

  const matrix = await routing.travelMatrix(punkte)

  // Basis-Fahrzeit ohne Kandidaten (Reihenfolge Depot,1..n).
  const basis = simuliere(
    [0, ...range(1, n)],
    tour.startZeit,
    matrix,
    knoten,
  )

  let best: FitMatch | null = null

  // Jede Einfügeposition 0..n unter den Einsätzen durchprobieren.
  for (let p = 0; p <= n; p++) {
    const besuche = [...range(1, p), kandidatIdx, ...range(p + 1, n)]
    const order = [0, ...besuche]
    const sim = simuliere(order, tour.startZeit, matrix, knoten)
    if (!sim.machbar) continue

    const mehrweg = sim.fahrzeit - basis.fahrzeit
    // Position des Kandidaten in order ist p+1 (nach dem Depot).
    const ankunft = Math.round(sim.ankunft[p + 1])

    if (!best || mehrweg < best.mehrwegMin) {
      best = {
        tourId: tour.id,
        pflegekraftId: tour.pflegekraftId,
        mehrwegMin: Math.round(mehrweg * 10) / 10,
        position: p,
        ankunft,
        qualifikationOk: true,
      }
    }
  }

  return best
}

// Bewertet den Kandidaten gegen mehrere Touren und liefert die Treffer
// sortiert nach Mehrweg (aufsteigend) — die beste Lückenfüllung zuerst.
export async function fitScore(
  touren: Tour[],
  kandidat: Kandidat,
  routing: RoutingProvider,
): Promise<FitMatch[]> {
  const ergebnisse = await Promise.all(
    touren.map((t) => fitScoreFuerTour(t, kandidat, routing)),
  )
  return ergebnisse
    .filter((m): m is FitMatch => m !== null)
    .sort((a, b) => a.mehrwegMin - b.mehrwegMin)
}

// ── Hilfen ────────────────────────────────────────────────────────────────
function fensterKnoten(zf: Zeitfenster, dauer: number): Knoten {
  return { von: zf.von, bis: zf.bis, dauer }
}

// Ganzzahlbereich [from, to] inklusive; leer, wenn from > to.
function range(from: number, to: number): number[] {
  const r: number[] = []
  for (let i = from; i <= to; i++) r.push(i)
  return r
}
