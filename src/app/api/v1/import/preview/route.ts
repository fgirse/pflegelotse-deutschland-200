import { NextResponse, type NextRequest } from 'next/server'
import { parseCsv } from '@/server/import/csv'
import { requireAuth } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'

// POST /api/v1/import/preview — CSV im Body (text/plain). Liefert die erkannten
// Spalten und ein paar Beispielzeilen für die Spaltenzuordnung im UI.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  const text = await req.text()
  if (!text.trim()) {
    return NextResponse.json({ error: 'Leere Datei' }, { status: 400 })
  }
  const { headers, rows } = parseCsv(text)
  return NextResponse.json({ headers, sample: rows.slice(0, 5), anzahl: rows.length })
}
