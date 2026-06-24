import { NextResponse, type NextRequest } from 'next/server'
import { kiChatRequestSchema } from '@/shared/ki'
import { frageLotsen } from '@/server/ki/service'

// POST /api/v1/ki/chat — KI-Pflegelotse (/F600/). Öffentlich (Angehörige),
// serverseitig: der Anthropic-Key erreicht nie den Browser. Es werden nur die
// Chat-Nachrichten übertragen, keine PII (/F640/).
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const parsed = kiChatRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const ergebnis = await frageLotsen(parsed.data.nachrichten)
    return NextResponse.json(ergebnis)
  } catch (e) {
    // Detail nur serverseitig loggen; dem Client eine generische Meldung geben.
    console.error('KI-Lotse-Fehler:', (e as Error).message)
    return NextResponse.json(
      { error: 'KI-Pflegelotse derzeit nicht verfügbar.' },
      { status: 502 },
    )
  }
}
