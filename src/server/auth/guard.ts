import { NextResponse } from 'next/server'
import { payloadClient } from '@/server/payloadClient'
import { COOKIE_2FA, verify2fa } from './twofactor'
import type { Rolle } from '@/collections/access'

export interface AuthUser {
  id: string
  email: string
  role: Rolle
  tenantId?: string
  totpEnabled?: boolean
  dienstName?: string
}

// Rollen mit Klientendatenzugriff — für sie ist 2FA verpflichtend (/Q110/).
const ROLLEN_MIT_2FA: Rolle[] = ['disponent', 'admin', 'pflegekraft']

// Liest den authentifizierten Payload-Nutzer aus dem Request-Cookie.
export async function getAuthUser(headers: Headers): Promise<AuthUser | null> {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers })
  if (!user) return null
  return {
    id: String(user.id),
    email: (user as { email?: string }).email ?? '',
    role: (user as { role?: Rolle }).role ?? 'disponent',
    tenantId: (user as { tenantId?: string }).tenantId,
    totpEnabled: (user as { totpEnabled?: boolean }).totpEnabled,
    dienstName: (user as { dienstName?: string }).dienstName,
  }
}

// Cookie aus dem Header lesen (Edge/Node-kompatibel).
function readCookie(headers: Headers, name: string): string | undefined {
  const raw = headers.get('cookie')
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

export interface GuardOptions {
  roles?: Rolle[] // erlaubte Rollen (Default: alle Dienst-Mitarbeiter)
  require2fa?: boolean // Default: true für Rollen mit Klientendatenzugriff
}

export type GuardErgebnis = { ok: true; user: AuthUser } | { ok: false; response: NextResponse }

// Zentraler RBAC-/2FA-Guard für die v1-API. Liefert entweder den Nutzer oder
// eine fertige Fehlerantwort (401/403).
export async function requireAuth(
  headers: Headers,
  opts: GuardOptions = {},
): Promise<GuardErgebnis> {
  const user = await getAuthUser(headers)
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) }
  }

  // Rollenprüfung.
  const erlaubt = opts.roles ?? (['disponent', 'admin', 'pflegekraft', 'plattform_admin'] as Rolle[])
  if (!erlaubt.includes(user.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 }) }
  }

  // 2FA-Prüfung: für Klientendaten-Rollen verpflichtend.
  const brauchtZweiFaktor = opts.require2fa ?? ROLLEN_MIT_2FA.includes(user.role)
  if (brauchtZweiFaktor) {
    if (!user.totpEnabled) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: '2FA nicht eingerichtet', code: 'TOTP_SETUP_REQUIRED' },
          { status: 403 },
        ),
      }
    }
    const cookie = readCookie(headers, COOKIE_2FA)
    if (!verify2fa(cookie, user.id)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: '2FA erforderlich', code: 'TOTP_REQUIRED' },
          { status: 403 },
        ),
      }
    }
  }

  return { ok: true, user }
}
