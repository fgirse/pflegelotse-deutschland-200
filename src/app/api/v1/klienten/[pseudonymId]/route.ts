import { NextResponse, type NextRequest } from 'next/server'
import { pseudonymIdSchema } from '@/shared/domain'
import { klientBearbeitenSchema } from '@/shared/klient'
import { requireAuth } from '@/server/auth/guard'
import { speichereKlient } from '@/server/klienten/bearbeiten'
import { loescheKlient } from '@/server/klienten/loeschen'

export const dynamic = 'force-dynamic'

// PUT /api/v1/klienten/[pseudonymId] — Klient über beide Säulen speichern.
// Nur Disponent/Admin, streng mandantengebunden (eigener Klient).
export async function PUT(req: NextRequest, ctx: { params: Promise<{ pseudonymId: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { pseudonymId } = await ctx.params
  if (!pseudonymIdSchema.safeParse(pseudonymId).success) {
    return NextResponse.json({ error: 'Ungültige Kennung' }, { status: 400 })
  }

  const parsed = klientBearbeitenSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const klient = await speichereKlient(auth.user.tenantId, pseudonymId, parsed.data)
  if (!klient) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true, klient })
}

// DELETE /api/v1/klienten/[pseudonymId] — Klienten löschen (beide Säulen +
// Crypto-Shredding, Art. 17). Nur Disponent/Admin, eigener Mandant.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ pseudonymId: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { pseudonymId } = await ctx.params
  if (!pseudonymIdSchema.safeParse(pseudonymId).success) {
    return NextResponse.json({ error: 'Ungültige Kennung' }, { status: 400 })
  }

  const ok = await loescheKlient(auth.user.tenantId, pseudonymId)
  if (!ok) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
