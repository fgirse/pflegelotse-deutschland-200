import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuthUser, type AuthUser } from './guard'
import { COOKIE_2FA, verify2fa } from './twofactor'

// Schützt eine Dienst-Seite (Server Component): erfordert angemeldeten Nutzer
// mit gültiger 2FA-Sitzung UND Mandantenzuordnung. Sonst Weiterleitung.
// Liefert den Nutzer mit garantierter tenantId zurück.
export async function requireDienstSeite(
  locale: string,
): Promise<AuthUser & { tenantId: string }> {
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

  // Ohne Mandantenzuordnung gibt es keine Daten. Statt still zurück zum Login
  // (wirkt wie ein 2FA-Fehler) auf eine klare Hinweisseite leiten.
  if (!user.tenantId) redirect(`/${locale}/kein-mandant`)

  return user as AuthUser & { tenantId: string }
}

// Schützt eine Suchenden-Seite (z. B. „Meine Bedarfe"): nur angemeldeter
// Nutzer nötig — kein 2FA, kein Mandant (Suchende haben keinen Klientendaten-
// zugriff). Sonst Weiterleitung zum Login.
export async function requireAngehoerige(locale: string): Promise<AuthUser> {
  const h = await headers()
  const user = await getAuthUser(h)
  if (!user) redirect(`/${locale}/login`)
  return user
}
