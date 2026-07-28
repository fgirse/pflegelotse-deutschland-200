import { NextResponse, type NextRequest } from 'next/server'
import { evoSchema } from '@/server/ti/evo'
import { mappeFhirBundle } from '@/server/ti/fhir'
import { verarbeiteEvo } from '@/server/ti/service'
import { requireAuth } from '@/server/auth/guard'

// POST /api/v1/ti/evo — Eingang einer elektronischen Verordnung (§8.2).
// Nimmt BEIDE Formate: ein KBV-FHIR-Bundle (resourceType=Bundle → wird gemappt)
// oder die vereinfachte JSON-Nutzlast. STUB-Transport: im echten Betrieb liefert
// der KIM-Fachdienst/Konnektor (SMC-B) die Nutzlast an genau diesen Handler.
// Geschützt: der Dienst empfängt in seinen eigenen Mandanten (tenantId).
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)

  // FHIR-Bundle → auf das interne Modell abbilden; sonst direkt vereinfachtes JSON.
  let roh: unknown = body
  if (body && (body as { resourceType?: string }).resourceType === 'Bundle') {
    const gemappt = mappeFhirBundle(body)
    if ('fehler' in gemappt) {
      return NextResponse.json({ error: `FHIR: ${gemappt.fehler}` }, { status: 400 })
    }
    roh = gemappt.ok
  }

  // Beide Pfade laufen durch dieselbe Validierung.
  const parsed = evoSchema.safeParse(roh)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const ergebnis = await verarbeiteEvo(auth.user.tenantId, parsed.data)
  const status = ergebnis.status === 'geocoding_fehlgeschlagen' ? 422 : 201
  return NextResponse.json(ergebnis, { status })
}
