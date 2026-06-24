import { NextResponse, type NextRequest } from 'next/server'
import { parseCsv, importiereKlienten } from '@/server/import/csv'
import { requireAuth } from '@/server/auth/guard'

// POST /api/v1/import/clients — CSV im Body (text/csv). Teilt jeden Datensatz
// sofort in Säule 1 (PII) und Säule 2 (operativ). Geschützt; Mandant aus Nutzer.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const text = await req.text()
  if (!text.trim()) {
    return NextResponse.json({ error: 'Leerer CSV-Body' }, { status: 400 })
  }
  const rows = parseCsv(text)
  const ergebnis = await importiereKlienten(auth.user.tenantId, rows)
  return NextResponse.json(ergebnis)
}
