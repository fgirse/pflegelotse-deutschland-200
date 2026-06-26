import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/server/auth/guard'
import { payloadClient } from '@/server/payloadClient'

export const dynamic = 'force-dynamic'

const DIENST_ROLLEN = ['disponent', 'admin', 'pflegekraft'] as const

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(100),
})

// GET — aktuelles Einzugsgebiet des angemeldeten Dienst-Nutzers.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: [...DIENST_ROLLEN] })
  if (!auth.ok) return auth.response
  const payload = await payloadClient()
  const u = await payload.findByID({ collection: 'users', id: auth.user.id, overrideAccess: true })
  const g = (u as { einzugsGeo?: { lat?: number; lng?: number }; einzugsRadiusKm?: number })
  return NextResponse.json({
    lat: g.einzugsGeo?.lat ?? null,
    lng: g.einzugsGeo?.lng ?? null,
    radiusKm: g.einzugsRadiusKm ?? null,
  })
}

// POST — Einzugsgebiet (Standort + Radius) setzen. Bedarfe im Umkreis werden
// dem Dienst dann angezeigt, auch ohne passende Tour.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: [...DIENST_ROLLEN] })
  if (!auth.ok) return auth.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const payload = await payloadClient()
  await payload.update({
    collection: 'users',
    id: auth.user.id,
    data: {
      einzugsGeo: { lat: parsed.data.lat, lng: parsed.data.lng },
      einzugsRadiusKm: parsed.data.radiusKm,
    },
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true })
}
