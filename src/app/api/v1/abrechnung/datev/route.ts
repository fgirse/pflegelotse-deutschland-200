import { NextResponse, type NextRequest } from 'next/server'
import { exportiereDatev } from '@/server/abrechnung/service'
import { requireAuth } from '@/server/auth/guard'

const DATUM = /^\d{4}-\d{2}-\d{2}$/

// Erzeugungszeitstempel YYYYMMDDHHMMSSFFF (DATEV-Kopf).
function stempel(): string {
  const d = new Date()
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}`
}

// GET /api/v1/abrechnung/datev?von&bis — DATEV-EXTF-Buchungsstapel (§8.3) als
// CSV-Download (ANSI/Windows-1252, wie von DATEV erwartet).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })

  const von = req.nextUrl.searchParams.get('von')
  const bis = req.nextUrl.searchParams.get('bis')
  if (!von || !bis || !DATUM.test(von) || !DATUM.test(bis)) {
    return NextResponse.json({ error: 'von/bis als YYYY-MM-DD erforderlich' }, { status: 400 })
  }

  const { csv } = await exportiereDatev(auth.user.tenantId, von, bis, stempel())
  return new NextResponse(Buffer.from(csv, 'latin1'), {
    headers: {
      'content-type': 'text/csv; charset=windows-1252',
      'content-disposition': `attachment; filename="datev-${von}_${bis}.csv"`,
    },
  })
}
