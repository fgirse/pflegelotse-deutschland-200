// ── Degradierungs-Meldung des Routings ───────────────────────────────────
// Warum es das gibt: Der FallbackRoutingProvider fängt jeden Fehler des
// Straßen-Providers ab und rechnet weiter mit Luftlinie. Das hält die Planung
// am Leben — verwandelt aber einen Ausfall in STILL falsche Fahrzeiten. Genau
// darauf beruht das Kernversprechen des Produkts ("passgenaue Zusatzmarge auf
// die reale Route"), also darf so ein Rückfall nicht unbemerkt bleiben.
//
// Hier wird er gezählt und gemeldet — entprellt, damit ein längerer Ausfall
// nicht tausende identische Sentry-Events erzeugt.

export type DegradierungsGrund =
  | 'nichtKonfiguriert' // ROUTING_PROVIDER=haversine — bewusst Luftlinie
  | 'fehlkonfiguriert' // Straßen-Provider gewählt, aber Key/URL fehlt
  | 'nichtErreichbar' // Straßen-Provider konfiguriert, antwortet aber nicht

// Entprell-Fenster: pro Grund höchstens eine Meldung je 5 Minuten.
export const MELDE_FENSTER_MS = 5 * 60 * 1000

// Zeitpunkt der letzten Meldung je Grund (prozessweit, pro Serverless-Instanz).
const zuletzt = new Map<DegradierungsGrund, number>()

// Reine Entprell-Entscheidung: soll dieser Grund jetzt gemeldet werden?
// Ein `true` vermerkt den Zeitpunkt — der Aufrufer meldet dann tatsächlich.
export function sollMelden(grund: DegradierungsGrund, jetzt = Date.now()): boolean {
  const letzte = zuletzt.get(grund)
  if (letzte != null && jetzt - letzte < MELDE_FENSTER_MS) return false
  zuletzt.set(grund, jetzt)
  return true
}

// Nur für Tests: Entprell-Zustand zurücksetzen.
export function resetMeldungen(): void {
  zuletzt.clear()
}

// Meldet eine Routing-Degradierung nach außen: immer ins Server-Log, zusätzlich
// (entprellt) als Sentry-Warnung fürs Monitoring. Sentry wird bewusst LAZY
// geladen — so zieht der reine Routing-Kern die Instrumentierung nicht in
// Unit-Tests, und ohne DSN bleibt alles ein No-Op.
export function meldeDegradierung(grund: DegradierungsGrund, detail?: string): void {
  const text = `[routing] degradiert auf Luftlinie (${grund})${detail ? `: ${detail}` : ''}`
  console.warn(text)
  if (!sollMelden(grund)) return
  void import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.captureMessage(text, {
        level: 'warning',
        tags: { bereich: 'routing', grund },
      })
    })
    .catch(() => {
      // Sentry nicht verfügbar (z. B. im Test) — das Log oben genügt.
    })
}
