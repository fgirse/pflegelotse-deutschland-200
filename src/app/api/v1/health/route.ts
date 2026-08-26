import { NextResponse } from 'next/server'
import { payloadClient } from '@/server/payloadClient'
import { routingStatus } from '@/server/routing/konfig'
import { pruefeKrypto } from '@/server/identity/kryptoPruefung'

export const dynamic = 'force-dynamic'

// GET /api/v1/health — Health-Check fürs Uptime-Monitoring.
//
// Prüft drei Dinge und meldet sie getrennt, weil sie unterschiedlich schwer
// wiegen. Bewusst ohne sensible Details: keine Provider-Namen, keine URLs,
// keine Daten — nur Zustände. Der Endpunkt ist öffentlich.
//
//   db      – erreichbar? Nur das entscheidet über 200 vs. 503.
//   krypto  – passt der ENCRYPTION_MASTER_KEY zu den Säule-1-Daten? Passt er
//             nicht, läuft die App weiter und zeigt nur keine Namen mehr —
//             ein Fehler, der sonst erst Tagen später auffällt.
//   routing – echte Straßenfahrzeiten oder nur Luftlinien-Schätzung?
//
// `status` fasst zusammen: 'ok' | 'degraded' (App läuft, aber fachlich
// beeinträchtigt) | 'error' (DB weg). Für ein Monitoring genügt damit ein
// Check auf `status`, ohne die Einzelfelder auszuwerten.
export async function GET() {
  try {
    const payload = await payloadClient()
    await payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true })

    // Erst ab hier sinnvoll: der Krypto-Selbsttest setzt eine erreichbare
    // Datenbank voraus (sonst wäre ein Verbindungsfehler nicht von einem
    // Schlüsselfehler zu unterscheiden).
    const [krypto, routing] = await Promise.all([
      pruefeKrypto().catch(() => null),
      routingStatus().catch(() => null),
    ])

    // 'nichtKonfiguriert' beim Routing ist eine bewusste Betreiber-Entscheidung
    // (Dev/Pilot ohne OSRM) und daher keine Degradierung; die anderen Gründe
    // sind Störfälle. 'keineDaten' bei der Krypto-Prüfung heißt nur: es gibt
    // noch nichts zu entschlüsseln.
    const kryptoDefekt = krypto?.modus === 'schluesselFehler'
    const routingDefekt = Boolean(routing?.grund && routing.grund !== 'nichtKonfiguriert')

    return NextResponse.json({
      status: kryptoDefekt || routingDefekt ? 'degraded' : 'ok',
      db: 'up',
      krypto: krypto ? krypto.modus : 'unbekannt',
      routing: routing
        ? { modus: routing.modus, ...(routing.grund ? { grund: routing.grund } : {}) }
        : { modus: 'unbekannt' },
    })
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'down', krypto: 'unbekannt', routing: { modus: 'unbekannt' } },
      { status: 503 },
    )
  }
}
