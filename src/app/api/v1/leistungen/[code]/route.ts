import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth/guard'
import { leistungSpeichernSchema } from '@/shared/leistungskatalog'
import { speichereLeistung, loescheLeistung } from '@/server/leistungen/service'

export const dynamic = 'force-dynamic'

const CODE = /^[A-Za-z0-9]{1,16}$/

// PUT /api/v1/leistungen/[code] — Katalog-Eintrag anlegen/aktualisieren.
// DELETE /api/v1/leistungen/[code] — Eintrag löschen. Disponent/Admin,
// mandantengebunden (tenantId aus der Sitzung).
export async function PUT(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { code } = await ctx.params
  if (!CODE.test(code)) {
    return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 })
  }

  const parsed = leistungSpeichernSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const eintrag = await speichereLeistung(auth.user.tenantId, code, parsed.data)
  return NextResponse.json({ ok: true, eintrag })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { code } = await ctx.params
  const ok = await loescheLeistung(auth.user.tenantId, code)
  if (!ok) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
