import type { ErrorEvent, Event, Breadcrumb } from '@sentry/nextjs'

// ── Sentry-Basisoptionen mit aktiver PII-Filterung ───────────────────────
// Datenschutz-Invariante des Projekts: niemals Klartext-PII oder Säule-1-Daten
// nach außen geben. Sentry ist Auftragsverarbeiter — deshalb filtern wir vor
// dem Versand alles heraus, was personenbezogen sein könnte (Request-Bodies
// mit KI-Chat/Bedarfen/Kontaktdaten, Cookies, Auth-Header, Query-Strings,
// Nutzeridentität). Session Replay ist bewusst NICHT aktiv (DOM/Eingaben).

// DSN aus der Umgebung; ohne DSN bleibt Sentry inaktiv (No-Op).
export const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN

// Entfernt potenziell personenbezogene Felder aus einem Event. Generisch,
// damit der konkrete Event-Typ (z. B. ErrorEvent) erhalten bleibt; exportiert,
// damit die Garantie testbar ist.
export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) {
    // Request-Body kann KI-Chat-Text, Pflegebedarfe oder Kontaktdaten enthalten.
    delete event.request.data
    delete event.request.cookies
    const headers = event.request.headers as Record<string, string> | undefined
    if (headers) {
      delete headers['authorization']
      delete headers['Authorization']
      delete headers['cookie']
      delete headers['Cookie']
    }
    // Nur den Pfad behalten, Query-String (mögliche IDs/Parameter) abschneiden.
    if (event.request.url) event.request.url = event.request.url.split('?')[0]
  }
  // Keine Nutzeridentität (E-Mail/IP/ID) übertragen.
  delete event.user
  return event
}

// Verwirft/leert Breadcrumbs, die PII durchsickern lassen könnten.
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  // Konsolen-Logs können beliebige Daten enthalten — komplett verwerfen.
  if (crumb.category === 'console') return null
  // Bei HTTP-Breadcrumbs den Body entfernen.
  if ((crumb.category === 'fetch' || crumb.category === 'xhr') && crumb.data) {
    delete crumb.data.body
  }
  return crumb
}

export const commonOptions = {
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Nie automatisch IP/Cookies/Header anhängen.
  sendDefaultPii: false,
  // Moderate Performance-Stichprobe (10 %).
  tracesSampleRate: 0.1,
  beforeSend: (event: ErrorEvent) => scrubEvent(event),
  beforeBreadcrumb: (crumb: Breadcrumb) => scrubBreadcrumb(crumb),
}
