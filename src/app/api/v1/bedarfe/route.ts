import { NextResponse, type NextRequest } from 'next/server'
import { bedarfErstellenSchema } from '@/shared/marketplace'
import { erstelleBedarf, listeBedarfeFuerDienst } from '@/server/marketplace/service'
import { requireAuth } from '@/server/auth/guard'

// POST /api/v1/bedarfe — Angehörige stellt einen Bedarf ein (Säulen-Split +
// Fan-out an passende Dienste). Antwort: Bedarfs-ID + Anzahl passender Dienste.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = bedarfErstellenSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { bedarfId, matchingTenants } = await erstelleBedarf(parsed.data)
  return NextResponse.json({ bedarfId, passendeDienste: matchingTenants.length }, { status: 201 })
}

// GET /api/v1/bedarfe — passende, offene Bedarfe für den eingeloggten Dienst
// (anonym, ohne PII). Geschützt; Mandant aus dem Nutzer.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers)
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const bedarfe = await listeBedarfeFuerDienst(auth.user.tenantId)
  return NextResponse.json({ bedarfe })
}
