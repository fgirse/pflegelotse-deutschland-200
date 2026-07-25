import { NextResponse, type NextRequest } from 'next/server'
import { exportiereKassen } from '@/server/abrechnung/service'
import { requireAuth } from '@/server/auth/guard'

const DATUM = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/abrechnung/kassen?von&bis — abrechnungsvorbereitendes Kassen-CSV
// (§8.3, NICHT das zertifizierte §302-Format) als Download. UTF-8 mit BOM für Excel.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })

  const von = req.nextUrl.searchParams.get('von')
  const bis = req.nextUrl.searchParams.get('bis')
  if (!von || !bis || !DATUM.test(von) || !DATUM.test(bis)) {
    return NextResponse.json({ error: 'von/bis als YYYY-MM-DD erforderlich' }, { status: 400 })
  }

  const { csv } = await exportiereKassen(auth.user.tenantId, von, bis)
  // BOM (﻿) voranstellen, damit Excel UTF-8 (Umlaute) korrekt erkennt.
  return new NextResponse('﻿' + csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="kassen-${von}_${bis}.csv"`,
    },
  })
}
