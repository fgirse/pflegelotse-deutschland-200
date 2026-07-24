import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import type { Tour } from '@/shared/domain'
import { simuliere, fensterKnoten, besuchsdauer, type Knoten } from './fitScore'

// ── VRPTW-Sequencing für EINE Tour (Pflichtenheft 5.2.1) ──────────────────
// Optimiert die Reihenfolge der Stopps einer bereits einer Pflegekraft
// zugeordneten Tour, sodass die Gesamtfahrzeit minimal wird — unter allen
// harten Restriktionen. Diese werden NICHT hier dupliziert, sondern über
// simuliere() aus dem Matcher bewertet (Zeitfenster, ArbZG §3/§4, Schichtende,
// Endpunkt, Grundzeit). Die heutige Nearest-Insertion (fitScoreFuerTour) bleibt
// der Spezialfall „ein Kandidat in eine fixe Tour"; hier wird die ganze Tour
// neu sortiert.
//
// Die Zuordnung von Einsätzen zu Pflegekräften (Multi-Vehicle) ist bewusst
// NICHT Teil hiervon (gehört zur Tages-/Wochenplanung, 2.2/2.3).

export interface OptimierteTour {
  einsaetze: Tour['einsaetze'] // neu sortierte Einsatzfolge
  fahrzeitMin: number
  arbeitszeitMin: number
  machbar: boolean // false, wenn keine machbare Reihenfolge gefunden wurde
}

export interface TourOptimizer {
  optimiere(tour: Tour, routing: RoutingProvider): Promise<OptimierteTour>
}

type Sim = ReturnType<typeof simuliere>

// Vergleich zweier Reihenfolgen: eine MACHBARE schlägt immer eine unmachbare;
// unter machbaren gewinnt weniger Fahrzeit (Tie: weniger Arbeitszeit). Nur
// echte Verbesserungen zählen (strikt), damit die Suche deterministisch endet.
function besser(a: Sim, b: Sim): boolean {
  if (a.machbar !== b.machbar) return a.machbar
  if (a.fahrzeit !== b.fahrzeit) return a.fahrzeit < b.fahrzeit
  return a.arbeitszeit < b.arbeitszeit
}

// Löst die Reihenfolge per lokaler Suche: Cheapest-Insertion-Konstruktion als
// zweiter Startpunkt, dann 2-opt + Or-opt bis zum lokalen Optimum. Reines
// TypeScript, in-process, deterministisch (keine Zufallszahlen).
export class LocalSearchTourOptimizer implements TourOptimizer {
  async optimiere(tour: Tour, routing: RoutingProvider): Promise<OptimierteTour> {
    const n = tour.einsaetze.length

    // Punkte, Knoten und Endpunkt wie im Matcher aufbauen.
    const punkte = [tour.start, ...tour.einsaetze.map((e) => e.geo)]
    let endeIdx = 0
    if (tour.ende) {
      punkte.push(tour.ende)
      endeIdx = punkte.length - 1
    }
    const knoten: Knoten[] = [
      { von: 0, bis: 1439, dauer: 0 }, // Depot ohne Fenster
      ...tour.einsaetze.map((e) => fensterKnoten(e.zeitfenster, besuchsdauer(e.dauerMin, e.grundzeitMin))),
    ]
    const verfuegbarBis = tour.verfuegbarBis ?? 1439
    const matrix = await routing.travelMatrix(punkte)

    // Bewertet eine Besuchsreihenfolge (Indizes 1..n) über das Constraint-Orakel.
    const bewerte = (visits: number[]): Sim =>
      simuliere([0, ...visits], tour.startZeit, matrix, knoten, endeIdx, verfuegbarBis)

    const ergebnis = (order: number[], sim: Sim): OptimierteTour => ({
      einsaetze: order.map((i) => tour.einsaetze[i - 1]),
      fahrzeitMin: Math.round(sim.fahrzeit),
      arbeitszeitMin: Math.round(sim.arbeitszeit),
      machbar: sim.machbar,
    })

    // 0 oder 1 Einsatz: nichts zu sortieren.
    if (n <= 1) {
      const order = bereich(1, n)
      return ergebnis(order, bewerte(order))
    }

    // Zwei Startpunkte: aktuelle Reihenfolge und Cheapest-Insertion. Aus beiden
    // per lokaler Suche verbessern und die bessere Lösung nehmen.
    const a = this.lokaleSuche(bereich(1, n), bewerte)
    const b = this.lokaleSuche(this.konstruiere(n, bewerte), bewerte)
    const gewinner = besser(b.sim, a.sim) ? b : a
    return ergebnis(gewinner.order, gewinner.sim)
  }

  // Cheapest-Insertion: fügt die Einsätze 1..n nacheinander an der jeweils
  // günstigsten (bzw. am ehesten machbaren) Position ein.
  private konstruiere(n: number, bewerte: (v: number[]) => Sim): number[] {
    let order: number[] = []
    for (let v = 1; v <= n; v++) {
      let bestPos = 0
      let bestSim: Sim | null = null
      for (let pos = 0; pos <= order.length; pos++) {
        const cand = [...order.slice(0, pos), v, ...order.slice(pos)]
        const sim = bewerte(cand)
        if (!bestSim || besser(sim, bestSim)) {
          bestPos = pos
          bestSim = sim
        }
      }
      order = [...order.slice(0, bestPos), v, ...order.slice(bestPos)]
    }
    return order
  }

  // 2-opt (Segment umdrehen) + Or-opt (Kette 1..3 verschieben) bis zum lokalen
  // Optimum. Deterministische Nachbarschaftsreihenfolge; der Guard verhindert
  // im Extremfall eine Endlosschleife.
  private lokaleSuche(init: number[], bewerte: (v: number[]) => Sim): { order: number[]; sim: Sim } {
    let best = init
    let bestSim = bewerte(best)
    let verbessert = true
    let guard = 0
    while (verbessert && guard++ < 2000) {
      verbessert = false

      // 2-opt: Segment [i..j] umkehren.
      for (let i = 0; i < best.length - 1; i++) {
        for (let j = i + 1; j < best.length; j++) {
          const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)]
          const sim = bewerte(cand)
          if (besser(sim, bestSim)) {
            best = cand
            bestSim = sim
            verbessert = true
          }
        }
      }

      // Or-opt: zusammenhängende Kette der Länge 1..3 an andere Position setzen.
      for (let L = 1; L <= 3 && L < best.length; L++) {
        for (let p = 0; p + L <= best.length; p++) {
          const seg = best.slice(p, p + L)
          const rest = [...best.slice(0, p), ...best.slice(p + L)]
          for (let q = 0; q <= rest.length; q++) {
            if (q === p) continue
            const cand = [...rest.slice(0, q), ...seg, ...rest.slice(q)]
            const sim = bewerte(cand)
            if (besser(sim, bestSim)) {
              best = cand
              bestSim = sim
              verbessert = true
            }
          }
        }
      }
    }
    return { order: best, sim: bestSim }
  }
}

// Ganzzahlbereich [from, to] inklusive; leer, wenn from > to.
function bereich(from: number, to: number): number[] {
  const r: number[] = []
  for (let i = from; i <= to; i++) r.push(i)
  return r
}
