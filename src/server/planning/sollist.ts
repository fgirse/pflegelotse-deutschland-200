import type { Tour } from '@/shared/domain'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import { planeAblauf } from '@/server/matching/tourPlan'

// ── Soll-Ist-Abgleich (Pflichtenheft 5.2.2) ───────────────────────────────
// Stellt je Einsatz die geplante Ankunft (Soll, aus planeAblauf) gegen die
// erfasste Ist-Ankunft (§5.3). Reine Funktion mit injizierbarem Routing.

export const AUSREISSER_SCHWELLE_MIN = 15

export interface StoppAbweichung {
  pseudonymId: string
  sollAnkunft: number
  istAnkunft: number | null
  abweichungMin: number | null // Ist − Soll (+ zu spät, − zu früh); null = nicht erfasst
  ausreisser: boolean // |Abweichung| > Schwelle
  erledigt: boolean
  abweichungGrund?: string
}

export interface SollIstBericht {
  stopps: StoppAbweichung[]
  erfasst: number // Anzahl Stopps mit Ist-Ankunft
  puenktlich: number // davon innerhalb der Schwelle
  puenktlichkeitProzent: number | null // null, wenn nichts erfasst
  maxAbweichungMin: number | null
}

export async function sollIst(
  tour: Tour,
  routing: RoutingProvider,
  schwelleMin = AUSREISSER_SCHWELLE_MIN,
): Promise<SollIstBericht> {
  const plan = await planeAblauf(tour, routing)
  const sollNach = new Map(plan.einsaetze.map((e) => [e.pseudonymId, e.ankunft as number]))

  const stopps: StoppAbweichung[] = tour.einsaetze.map((e) => {
    const sollAnkunft = sollNach.get(e.pseudonymId) ?? 0
    const istAnkunft = typeof e.istAnkunft === 'number' ? e.istAnkunft : null
    const abweichungMin = istAnkunft === null ? null : istAnkunft - sollAnkunft
    return {
      pseudonymId: e.pseudonymId,
      sollAnkunft,
      istAnkunft,
      abweichungMin,
      ausreisser: abweichungMin !== null && Math.abs(abweichungMin) > schwelleMin,
      erledigt: Boolean(e.erledigt),
      abweichungGrund: e.abweichungGrund,
    }
  })

  const erfassteAbw = stopps.filter((s): s is StoppAbweichung & { abweichungMin: number } => s.abweichungMin !== null)
  const erfasst = erfassteAbw.length
  const puenktlich = erfassteAbw.filter((s) => Math.abs(s.abweichungMin) <= schwelleMin).length
  return {
    stopps,
    erfasst,
    puenktlich,
    puenktlichkeitProzent: erfasst > 0 ? Math.round((puenktlich / erfasst) * 100) : null,
    maxAbweichungMin: erfasst > 0 ? Math.max(...erfassteAbw.map((s) => Math.abs(s.abweichungMin))) : null,
  }
}
