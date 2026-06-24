import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// next-intl-Middleware für die lokalisierte Frontend-Site.
export default createMiddleware(routing)

export const config = {
  // Wichtig: Payload-Admin (/admin), Payload-API (/api), die eigene
  // Anwendungs-API (/api/v1) und Next-Interna NICHT abfangen — sonst würde
  // die Locale-Umleitung diese Routen brechen.
  matcher: ['/((?!api|admin|_next|_payload|.*\\..*).*)'],
}
