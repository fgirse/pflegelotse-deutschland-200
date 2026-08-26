// ── Selbsttest der Säule-1-Verschlüsselung: reine Logik ──────────────────
// Beantwortet die Frage, die sich sonst erst im Betrieb zeigt: Passt der
// ENCRYPTION_MASTER_KEY dieser Umgebung zu den vorhandenen Daten?
//
// Passt er nicht, bricht nichts sichtbar zusammen — die App läuft weiter und
// zeigt nur keine Klientennamen mehr. Ohne diesen Test merkt man das erst,
// wenn jemand im Dashboard vor leeren Feldern sitzt. Besonders relevant nach
// einem Schlüsselwechsel oder wenn eine neue Umgebung (Preview, zweite
// Region) mit einem anderen Wert hochkommt.
//
// Diese Datei bleibt bewusst frei von Payload-/DB-Importen, damit die
// Fallunterscheidung ohne Laufzeitumgebung testbar ist. Der Lesevorgang liegt
// in kryptoPruefung.ts.

export type KryptoModus =
  | 'ok' // Entschlüsselung erfolgreich, Schlüssel passt
  | 'schluesselFehler' // Daten vorhanden, aber nicht lesbar → falscher Schlüssel
  | 'keineDaten' // noch keine Identität angelegt — nichts zu prüfen

export type KryptoStatus = { modus: KryptoModus }

export const CACHE_OK_MS = 60_000
export const CACHE_FEHLER_MS = 20_000
export const MELDE_FENSTER_MS = 5 * 60 * 1000

// Reine Bewertung des Leseergebnisses. `vornameLesbar` ist bewusst ein Boolean
// statt des Werts: der Klartext darf diese Grenze nicht überschreiten — der
// Health-Endpoint, der das Ergebnis ausliefert, ist öffentlich.
export function bewerteKrypto(input: {
  gefunden: boolean
  vornameLesbar: boolean
  fehlgeschlagen?: boolean
}): KryptoStatus {
  // Ein Fehler beim Lesen ist der klassische Fall „falscher Schlüssel": die
  // afterRead-Hooks werfen beim Entschlüsseln.
  if (input.fehlgeschlagen) return { modus: 'schluesselFehler' }
  if (!input.gefunden) return { modus: 'keineDaten' }
  return { modus: input.vornameLesbar ? 'ok' : 'schluesselFehler' }
}
