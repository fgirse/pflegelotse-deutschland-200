import { NextResponse, type NextRequest } from 'next/server'
import { parseCsv, importiereKlienten } from '@/server/import/csv'
import { requireAuth } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'

// POST /api/v1/import/clients — Body JSON { csv, mapping }. mapping ordnet
// unseren Feldern (vorname, adresse, …) die Spaltennamen der Quelldatei zu.
// Teilt jeden Datensatz in Säule 1 (PII) und Säule 2 (operativ). Geschützt.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  const csv: string = typeof body?.csv === 'string' ? body.csv : ''
  const mapping: Record<string, string> = body?.mapping ?? {}
  if (!csv.trim()) {
    return NextResponse.json({ error: 'Leere CSV-Daten' }, { status: 400 })
  }

  const { rows } = parseCsv(csv)
  // Mapping anwenden: unsere Feldnamen ← Spalten der Quelldatei.
  const normalisiert = rows.map((r) => {
    const o: Record<string, string> = {}
    for (const [feld, spalte] of Object.entries(mapping)) {
      if (spalte) o[feld] = r[spalte] ?? ''
    }
    return o
  })

  const ergebnis = await importiereKlienten(auth.user.tenantId, normalisiert)
  return NextResponse.json(ergebnis)
}
