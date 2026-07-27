import { NextResponse, type NextRequest } from 'next/server'
import { berechneBerichte } from '@/server/berichte/service'
import { baueMitarbeiterCsv, baueKilometerCsv } from '@/server/berichte/csv'
import { requireAuth } from '@/server/auth/guard'

const DATUM = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/berichte/csv?von&bis&typ=auslastung|kilometer — CSV-Download eines
// §5.4-Berichts (UTF-8 mit BOM für Excel).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })

  const von = req.nextUrl.searchParams.get('von')
  const bis = req.nextUrl.searchParams.get('bis')
  const typ = req.nextUrl.searchParams.get('typ')
  if (!von || !bis || !DATUM.test(von) || !DATUM.test(bis) || (typ !== 'auslastung' && typ !== 'kilometer')) {
    return NextResponse.json({ error: 'von/bis (YYYY-MM-DD) und typ=auslastung|kilometer erforderlich' }, { status: 400 })
  }

  const b = await berechneBerichte(auth.user.tenantId, von, bis)
  const csv = typ === 'auslastung' ? baueMitarbeiterCsv(b.mitarbeiter) : baueKilometerCsv(b.kilometer)
  return new NextResponse('﻿' + csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${typ}-${von}_${bis}.csv"`,
    },
  })
}
