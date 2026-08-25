import { NextResponse } from 'next/server'
import { payloadClient } from '@/server/payloadClient'
import { routingStatus } from '@/server/routing/konfig'

export const dynamic = 'force-dynamic'

// GET /api/v1/health — leichtgewichtiger Health-Check für Uptime-Monitoring.
// Prüft die DB-Erreichbarkeit (eine minimale Abfrage) und meldet zusätzlich den
// Routing-Modus. Bewusst ohne sensible Details: kein Provider-Name, keine URLs,
// keine Zahlen — nur ob echte Straßenfahrzeiten vorliegen und warum nicht.
//
// Statuscode: nur die DB entscheidet über 200/503. Ein degradiertes Routing ist
// kein Ausfall (die App plant weiter, nur gröber) — es ist aber ein Zustand,
// auf den ein Monitoring eigenständig alarmieren können soll, deshalb steht er
// im Body.
export async function GET() {
  // Der Routing-Check ist gecacht und darf den Health-Check nie scheitern
  // lassen; im Zweifel bleibt das Feld unbekannt.
  const routing = await routingStatus().catch(() => null)
  const routingFeld = routing
    ? { modus: routing.modus, ...(routing.grund ? { grund: routing.grund } : {}) }
    : { modus: 'unbekannt' as const }

  try {
    const payload = await payloadClient()
    await payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true })
    return NextResponse.json({ status: 'ok', db: 'up', routing: routingFeld })
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'down', routing: routingFeld },
      { status: 503 },
    )
  }
}
