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

  // Erzwungener Passwortwechsel (Initial-Login): vor allem anderen auf die
  // Konto-Seite. Der Wechsel läuft VOR der 2FA (Reihenfolge nach Vorgabe).
  if (user.passwortWechselErforderlich) redirect(`/${locale}/konto?pflicht=1`)

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

// Schützt eine Seite, die nur eine Anmeldung braucht (z. B. „Konto/Passwort"):
// jede Rolle, kein 2FA-Zwang (sonst käme eine Pflegekraft vor der 2FA-
// Einrichtung nicht an die erzwungene Passwort-Seite). Kein Redirect bei
// gesetztem Wechsel-Flag — genau hier soll der Wechsel ja stattfinden.
export async function requireAngemeldet(locale: string): Promise<AuthUser> {
  const h = await headers()
  const user = await getAuthUser(h)
  if (!user) redirect(`/${locale}/login`)
  return user
}
