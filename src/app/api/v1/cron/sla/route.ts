import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { verarbeiteAbgelaufeneBedarfe } from '@/server/sla/service'

// SLA-Cron (/F430/): schließt abgelaufene Bedarfe ohne Zusage automatisch ab
// und benachrichtigt die Angehörige. Vercel ruft diesen Endpoint periodisch
// auf und sendet `Authorization: Bearer $CRON_SECRET`.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Authentifizierung: nur mit gültigem CRON_SECRET.
  const auth = req.headers.get('authorization')
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }
  const ergebnis = await verarbeiteAbgelaufeneBedarfe(new Date())
  return NextResponse.json(ergebnis)
}
