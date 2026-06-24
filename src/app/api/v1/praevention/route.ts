import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { praevErstellenSchema } from '@/shared/praevention'
import { erstellePraevention, listePraevention } from '@/server/praevention/service'
import { requireAuth } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'

const ROLLEN = ['pflegekraft', 'disponent', 'admin'] as const

// GET /api/v1/praevention?pseudonymId=... — Empfehlungen des Mandanten.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: [...ROLLEN] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })
  const pseudonymId = req.nextUrl.searchParams.get('pseudonymId') ?? undefined
  const liste = await listePraevention(auth.user.tenantId, pseudonymId)
  return NextResponse.json({ empfehlungen: liste })
}

// POST /api/v1/praevention — neue Erhebung; Empfehlungen werden bei Bedarf
// generiert. erstelltVon = angemeldeter Nutzer.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: [...ROLLEN] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })
  const parsed = praevErstellenSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const p = await erstellePraevention(auth.user.tenantId, auth.user.email, parsed.data)
  return NextResponse.json({ praevention: p }, { status: 201 })
}
