import { NextResponse, type NextRequest } from 'next/server'
import { zieheZurueck } from '@/server/marketplace/service'
import { getAuthUser } from '@/server/auth/guard'

type Ctx = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

// POST /api/v1/bedarfe/[id]/zurueckziehen — die/der Suchende zieht den eigenen
// Bedarf zurück. Keine Rollenbeschränkung; der Besitz wird im Service geprüft.
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getAuthUser(req.headers)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { id } = await params
  try {
    await zieheZurueck(id, user.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}
