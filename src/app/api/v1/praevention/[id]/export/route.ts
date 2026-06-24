import { NextResponse, type NextRequest } from 'next/server'
import { exportiereDokument } from '@/server/praevention/service'
import { requireAuth } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// GET — exportierbares Markdown-Dokument für die Pflegekasse (/F930/).
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: ['pflegekraft', 'disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })
  const { id } = await params
  const datum = new Date().toISOString().slice(0, 10)
  const dokument = await exportiereDokument(id, auth.user.tenantId, datum)
  if (!dokument) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return new NextResponse(dokument, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="praeventionsempfehlung-${id}.md"`,
    },
  })
}
