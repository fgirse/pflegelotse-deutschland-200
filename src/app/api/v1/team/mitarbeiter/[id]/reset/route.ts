import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/server/auth/guard'
import { setzeInitialPasswort, resette2faMitarbeiter } from '@/server/team/service'

export const dynamic = 'force-dynamic'

const schema = z.object({ typ: z.enum(['passwort', '2fa']) })

// POST /api/v1/team/mitarbeiter/[id]/reset { typ } — Admin setzt Passwort oder
// 2FA einer Pflegekraft zurück. Nur Admin; die Kraft muss zum eigenen Mandanten
// gehören (im Service geprüft). Beim Passwort-Reset kommt das neue Initial-
// Passwort EINMALIG in der Antwort zurück.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await ctx.params

  if (parsed.data.typ === 'passwort') {
    const tempPasswort = await setzeInitialPasswort(auth.user.tenantId, id)
    if (!tempPasswort) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    return NextResponse.json({ ok: true, tempPasswort })
  }

  const zeile = await resette2faMitarbeiter(auth.user.tenantId, id)
  if (!zeile) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true, mitarbeiter: zeile })
}
