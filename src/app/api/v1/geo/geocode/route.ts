import { NextResponse, type NextRequest } from 'next/server'
import { geocode } from '@/server/geo/service'

export const dynamic = 'force-dynamic'

// GET /api/v1/geo/geocode?q=… — wandelt eine Adresse/einen Ort in Koordinaten.
// Serverseitig (Geocoder-Policy/Key bleiben am Server). Öffentlich, weil das
// Bedarfsformular ohne Login genutzt wird; mit leichten Eingabe-Schranken.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 3 || q.length > 200) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }
  try {
    const treffer = await geocode(q)
    if (!treffer) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    return NextResponse.json(treffer)
  } catch {
    return NextResponse.json({ error: 'Geocoding fehlgeschlagen' }, { status: 502 })
  }
}
