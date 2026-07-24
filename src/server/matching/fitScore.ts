import type { FitScoreRequest, FitMatch, Tour, Zeitfenster } from '@/shared/domain'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'

// ── Restriktionen aus dem Pflichtenheft (Kap. 5.2.1 VRPTW, 5.1.3) ──────────
// Arbeitszeitgesetz (ArbZG): harte Restriktionen der Tourenplanung.
export const ARBZG = {
  maxArbeitszeitMin: 600, // §3: max. 10 h Arbeitszeit/Tag
  schwelle6hMin: 360, // §4: Pause nach >6 h Arbeit
  pauseNach6hMin: 30, // §4: mind. 30 min Pause bei 6–9 h
} as const

// Hausbesuchsgrundzeit (Kap. 5.1.3): fällt einmalig je Besuch an (Begrüßung,
// Krankenbeobachtung, Dokumentation), zusätzlich zur reinen Leistungszeit.
// Wird pro Einsatz/Kandidat geführt (Feld grundzeitMin); fehlt der Wert, gilt
// dieser Default. So kann jeder Dienst je Patient/Leistung einen Wert setzen.
export const GRUNDZEIT_DEFAULT_MIN = 0

// Gesamtzeit am Klienten für einen Besuch: reine Leistungszeit + Grundzeit.
export function besuchsdauer(dauerMin: number, grundzeitMin?: number): number {
  return dauerMin + (grundzeitMin ?? GRUNDZEIT_DEFAULT_MIN)
}

// Ein Knoten in der Tour-Simulation: Depot (ohne Fenster) oder Einsatz.
interface Knoten {
  von: number
  bis: number
  dauer: number
}

type Kandidat = FitScoreRequest['kandidat']

// Prüft, ob die Pflegekraft alle vom Kandidaten geforderten Qualifikationen hat.
export function qualifikationErfuellt(tour: Tour, kandidat: Kandidat): boolean {
  const vorhanden = new Set(tour.pflegekraftQualifikation)
  return kandidat.qualifikation.every((q) => vorhanden.has(q))
}

// Simuliert eine Einsatzfolge ab dem Depot und liefert Machbarkeit,
// Gesamtfahrzeit, Ankunftszeiten je Knoten und die Arbeitszeit.
// `order` enthält Matrix-Indizes; order[0] ist immer das Depot. `endeIdx` ist
// der Matrix-Index des Endpunkts (Pflichtenheft 5.1.2): der Rückweg vom letzten
// Stopp dorthin zählt zu Fahr- und Arbeitszeit. Ohne separaten Endpunkt ist das
// der Startpunkt (Index 0, Rundtour zum Depot).
// Harte Restriktionen: Zeitfenster (hard), ArbZG max. 10 h/Tag (hard);
// nach 6 h Arbeit wird einmalig eine Pflichtpause eingeschoben (§4 ArbZG).
function simuliere(
  order: number[],
  startZeit: number,
  matrix: number[][],
  knoten: Knoten[],
  endeIdx: number,
  verfuegbarBis: number, // Schichtende (Teilzeit): Einsatz muss bis dahin fertig sein
): { machbar: boolean; fahrzeit: number; ankunft: number[]; arbeitszeit: number } {
  let t = startZeit // Abfahrt am Depot
  let fahrzeit = 0
  let arbeit = 0 // Arbeitszeit = Fahrt + Leistung (ohne Wartezeit/Pause)
  let pauseGesetzt = false
  const ankunft = new Array(order.length).fill(0)

  for (let k = 1; k < order.length; k++) {
    const reise = matrix[order[k - 1]][order[k]]
    fahrzeit += reise
    arbeit += reise
    let ank = t + reise
    // ArbZG §4: nach 6 h Arbeit einmalig 30 min Pause einschieben.
    if (!pauseGesetzt && arbeit >= ARBZG.schwelle6hMin) {
      ank += ARBZG.pauseNach6hMin
      pauseGesetzt = true
    }
    ankunft[k] = ank
    const n = knoten[order[k]]
    // Wartet die Kraft, falls sie vor dem frühesten Beginn ankommt.
    const beginn = Math.max(ank, n.von)
    // Spätester Beginn überschritten → Zeitfenster verletzt (hard).
    if (beginn > n.bis) return { machbar: false, fahrzeit, ankunft, arbeitszeit: arbeit }
    // Teilzeit/Schichtende (§5.1.2): Einsatz muss bis verfuegbarBis fertig sein.
    if (beginn + n.dauer > verfuegbarBis) return { machbar: false, fahrzeit, ankunft, arbeitszeit: arbeit }
    arbeit += n.dauer
    t = beginn + n.dauer
  }
  // Rückweg vom letzten Stopp zum Endpunkt (Depot oder separater Tour-Endpunkt).
  const letzter = order[order.length - 1]
  const rueckweg = matrix[letzter][endeIdx]
  fahrzeit += rueckweg
  arbeit += rueckweg
  // ArbZG §3: max. 10 h Arbeitszeit/Tag (hard).
  const machbar = arbeit <= ARBZG.maxArbeitszeitMin
  return { machbar, fahrzeit, ankunft, arbeitszeit: arbeit }
}

// Berechnet den besten (geringsten) Mehrweg, mit dem sich der Kandidat in
// EINE Tour einfügen lässt, ohne eine harte Restriktion zu verletzen
// (Zeitfenster, Qualifikation, ArbZG). Gibt null zurück, wenn keine Position
// machbar ist. Bezugspflege wird als weiche Restriktion mitgeführt.
export async function fitScoreFuerTour(
  tour: Tour,
  kandidat: Kandidat,
  routing: RoutingProvider,
): Promise<FitMatch | null> {
  // Harte Bedingung 0: Verfügbarkeit. Pflegekraft an dem Tag abwesend
  // (Urlaub/Krankheit) → Tour steht nicht zur Verfügung (§5.1.2).
  if (tour.verfuegbar === false) return null
  // Harte Bedingung 1: Qualifikation. Fehlt sie, ist keine Position möglich.
  if (!qualifikationErfuellt(tour, kandidat)) return null

  const n = tour.einsaetze.length
  // Schichtende (Teilzeit): Standard = Tagesende (1439), sonst der gesetzte Wert.
  const verfuegbarBis = tour.verfuegbarBis ?? 1439
  // Punkt- und Knotenliste: 0=Depot, 1..n=Einsätze, n+1=Kandidat.
  const punkte = [
    tour.start,
    ...tour.einsaetze.map((e) => e.geo),
    kandidat.geo,
  ]
  // Endpunkt (Pflichtenheft 5.1.2): ohne separaten `ende` kehrt die Tour zum
  // Startpunkt zurück (Index 0). Ein eigener Endpunkt wird als weiterer Punkt
  // angehängt, damit der Rückweg dorthin in der Matrix steht.
  let endeIdx = 0
  if (tour.ende) {
    punkte.push(tour.ende)
    endeIdx = punkte.length - 1
  }
  // Leistungszeit + Hausbesuchsgrundzeit je Besuch (Kap. 5.1.3).
  const knoten: Knoten[] = [
    { von: 0, bis: 1439, dauer: 0 }, // Depot ohne Fenster
    ...tour.einsaetze.map((e) => fensterKnoten(e.zeitfenster, besuchsdauer(e.dauerMin, e.grundzeitMin))),
    fensterKnoten(kandidat.zeitfenster, besuchsdauer(kandidat.dauerMin, kandidat.grundzeitMin)),
  ]
  const kandidatIdx = n + 1

  const matrix = await routing.travelMatrix(punkte)

  // Basis-Fahrzeit ohne Kandidaten (Reihenfolge Depot,1..n, Rückweg zum Ende).
  const basis = simuliere(
    [0, ...range(1, n)],
    tour.startZeit,
    matrix,
    knoten,
    endeIdx,
    verfuegbarBis,
  )

  // Weiche Restriktion (Bezugspflege): gehört die Tour der bevorzugten Kraft?
  const bezugspflegeErfuellt = kandidat.bezugspflege
    ? tour.pflegekraftId === kandidat.bezugspflege
    : false

  let best: FitMatch | null = null

  // Jede Einfügeposition 0..n unter den Einsätzen durchprobieren.
  for (let p = 0; p <= n; p++) {
    const besuche = [...range(1, p), kandidatIdx, ...range(p + 1, n)]
    const order = [0, ...besuche]
    const sim = simuliere(order, tour.startZeit, matrix, knoten, endeIdx, verfuegbarBis)
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
        arbeitszeitMin: Math.round(sim.arbeitszeit),
        bezugspflegeErfuellt,
      }
    }
  }

  return best
}

// Bewertet den Kandidaten gegen mehrere Touren und liefert die Treffer
// sortiert: Bezugspflege zuerst (weiche Restriktion), dann nach Mehrweg
// aufsteigend — die beste, präferenzkonforme Lückenfüllung zuerst.
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
    .sort(
      (a, b) =>
        Number(b.bezugspflegeErfuellt) - Number(a.bezugspflegeErfuellt) ||
        a.mehrwegMin - b.mehrwegMin,
    )
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
