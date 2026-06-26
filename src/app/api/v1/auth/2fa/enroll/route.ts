import { NextResponse, type NextRequest } from 'next/server'
import QRCode from 'qrcode'
import { payloadClient } from '@/server/payloadClient'
import { getAuthUser } from '@/server/auth/guard'
import { generateSecret, otpauthURI } from '@/lib/totp'

export const dynamic = 'force-dynamic'

// POST /api/v1/auth/2fa/enroll — erzeugt ein TOTP-Geheimnis für den
// angemeldeten Nutzer und liefert die otpauth-URI zum Einrichten in der App.
// Aktiviert wird 2FA erst nach erfolgreicher Code-Bestätigung (activate).
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req.headers)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const secret = generateSecret()
  const payload = await payloadClient()
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { totpSecret: secret, totpEnabled: false },
    overrideAccess: true,
  })

  const otpauth = otpauthURI(secret, user.email)
  // QR-Code als PNG-Data-URL — die Authenticator-App scannt ihn direkt,
  // statt das Geheimnis abtippen zu müssen.
  const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 })

  return NextResponse.json({ secret, otpauth, qrDataUrl })
}
