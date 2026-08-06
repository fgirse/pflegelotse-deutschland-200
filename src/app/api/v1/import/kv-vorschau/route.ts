import { NextResponse, type NextRequest } from 'next/server'
import { parseCsv, normKostentraeger } from '@/server/import/csv'
import { KASSEN_PRIVAT } from '@/shared/krankenkassen'
import { requireAuth } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'

// Bekannte private Kassennamen für den Abgleich (klein geschrieben).
const PRIVAT_LOWER = new Set(KASSEN_PRIVAT.map((n) => n.toLowerCase()))

// POST /api/v1/import/kv-vorschau — Body JSON { csv, mapping }. Liefert die
// privat versicherten Zeilen (external_id + Rohwert der Kasse + „bekannt?"),
// damit im UI je Klient die private KV per Dropdown bestätigt/korrigiert wird.
// Keine PII (kein Name) — nur die externe Kundennummer zur Identifikation.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => null)
  const csv: string = typeof body?.csv === 'string' ? body.csv : ''
  const mapping: Record<string, string> = body?.mapping ?? {}
  if (!csv.trim()) {
    return NextResponse.json({ error: 'Leere CSV-Daten' }, { status: 400 })
  }

  const { rows } = parseCsv(csv)
  const gesehen = new Set<string>()
  const zeilen: { externalId: string; kasseRoh: string; bekannt: boolean }[] = []
  for (const r of rows) {
    const wert = (feld: string) => (mapping[feld] ? (r[mapping[feld]] ?? '') : '')
    if (normKostentraeger(wert('kostentraeger')) !== 'privat') continue
    const externalId = wert('external_id').trim()
    if (!externalId || gesehen.has(externalId)) continue
    gesehen.add(externalId)
    const kasseRoh = wert('krankenkasse').trim()
    zeilen.push({ externalId, kasseRoh, bekannt: PRIVAT_LOWER.has(kasseRoh.toLowerCase()) })
  }

  return NextResponse.json({ zeilen })
}
