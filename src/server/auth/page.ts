import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuthUser, type AuthUser } from './guard'
import { COOKIE_2FA, verify2fa } from './twofactor'

// Schützt eine Dienst-Seite (Server Component): erfordert angemeldeten Nutzer
// mit gültiger 2FA-Sitzung. Sonst Weiterleitung zur Login-Seite. Liefert den
// Nutzer (inkl. tenantId) zurück.
export async function requireDienstSeite(locale: string): Promise<AuthUser> {
  const h = await headers()
  const user = await getAuthUser(h)
  if (!user) redirect(`/${locale}/login`)

  // 2FA-Pflicht für Klientendaten-Rollen.
  const cookie = h
    .get('cookie')
    ?.split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_2FA}=`))
    ?.split('=')[1]
  if (!verify2fa(cookie ? decodeURIComponent(cookie) : undefined, user.id)) {
    redirect(`/${locale}/login`)
  }
  return user
}
