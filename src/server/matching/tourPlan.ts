import type { Tour } from '@/shared/domain'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import { ARBZG, besuchsdauer } from './fitScore'

// ── Tour-Ablauf berechnen (reine Funktion, injizierbares Routing) ─────────
// Verplant eine Tour in ihrer gegebenen Reihenfolge: Ankunftszeiten je Einsatz,
// Gesamtfahrzeit (inkl. Rückweg zum Endpunkt), Auslastung, Arbeitszeit und
// ArbZG-Konformität. Zusätzlich je Stopp `zeitfensterOk` — für die Drag&Drop-
// Vorschau (§5.2.3): wird ein Stopp nach seinem spätesten Beginn erreicht, ist
// die Reihenfolge dort verletzt.
//
// Anders als simuliere() bricht diese Rechnung NICHT bei einer Zeitfenster-
// Verletzung ab — sie plant alle Stopps durch, damit die UI jede Ankunft und
// jede Verletzung anzeigen kann.
export async function planeAblauf(tour: Tour, routing: RoutingProvider) {
  const punkte = [tour.start, ...tour.einsaetze.map((e) => e.geo)]
  let endeIdx = 0
  if (tour.ende) {
    punkte.push(tour.ende)
    endeIdx = punkte.length - 1
  }
  const matrix = await routing.travelMatrix(punkte)

  let t = tour.startZeit
  let fahrzeit = 0
  let pflege = 0
  let grundzeit = 0
  let arbeit = 0
  let pauseGesetzt = false

  const einsaetze = tour.einsaetze.map((e, i) => {
    const reise = matrix[i][i + 1]
    fahrzeit += reise
    arbeit += reise
    let ankunft = t + reise
    // ArbZG §4: nach 6 h Arbeit einmalig 30 min Pause einschieben.
    if (!pauseGesetzt && arbeit >= ARBZG.schwelle6hMin) {
      ankunft += ARBZG.pauseNach6hMin
      pauseGesetzt = true
    }
    const beginn = Math.max(ankunft, e.zeitfenster.von)
    const grund = e.grundzeitMin ?? 0
    const dauer = besuchsdauer(e.dauerMin, e.grundzeitMin)
    t = beginn + dauer
    pflege += e.dauerMin
    grundzeit += grund
    arbeit += dauer
    return { ...e, ankunft: Math.round(ankunft) }
  })

  // Rückweg vom letzten Stopp zum Endpunkt (Depot oder separater Endpunkt).
  const letzterIdx = tour.einsaetze.length
  const rueckweg = matrix[letzterIdx][endeIdx]
  fahrzeit += rueckweg
  arbeit += rueckweg

  const amKlienten = pflege + grundzeit
  const gesamt = amKlienten + fahrzeit
  const auslastung = gesamt > 0 ? Math.round((amKlienten / gesamt) * 100) : 0

  // Je Stopp: Ankunft und ob das Zeitfenster (spätester Beginn) eingehalten ist.
  const stops = einsaetze.map((e) => ({
    pseudonymId: e.pseudonymId,
    ankunft: e.ankunft as number,
    zeitfensterOk: (e.ankunft as number) <= e.zeitfenster.bis,
  }))

  return {
    einsaetze,
    fahrzeitMin: Math.round(fahrzeit),
    pflegezeitMin: Math.round(pflege),
    grundzeitMin: Math.round(grundzeit),
    auslastungProzent: auslastung,
    arbeitszeitMin: Math.round(arbeit),
    arbzgKonform: arbeit <= ARBZG.maxArbeitszeitMin,
    stops,
  }
}
