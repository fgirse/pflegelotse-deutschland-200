import { NextResponse } from 'next/server'
import { payloadClient } from '@/server/payloadClient'

export const dynamic = 'force-dynamic'

// GET /api/v1/health — leichtgewichtiger Health-Check für Uptime-Monitoring.
// Prüft die DB-Erreichbarkeit (eine minimale Abfrage) und gibt 200/503 zurück.
// Bewusst ohne sensible Details (keine Zahlen, keine Konfiguration).
export async function GET() {
  try {
    const payload = await payloadClient()
    await payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true })
    return NextResponse.json({ status: 'ok', db: 'up' })
  } catch {
    return NextResponse.json({ status: 'error', db: 'down' }, { status: 503 })
  }
}
