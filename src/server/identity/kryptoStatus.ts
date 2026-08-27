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

// Erkennt, ob ein gelesener Wert NICHT entschlüsselt wurde.
//
// Ein „ist der String nicht leer?"-Test genügt hier nicht — und das ist keine
// Feinheit, sondern der Kern des Problems: Beide Fehlerbilder liefern einen
// nicht-leeren String, und beide wären damit stillschweigend als „ok"
// durchgegangen.
//
//  1. Der Hook läuft nicht → der App-Crypto-Ciphertext steht roh da. Der hat
//     das Format iv:tag:data, alles Base64 — also zu 100 % druckbare Zeichen.
//     Eine reine „sieht lesbar aus"-Heuristik greift hier NICHT.
//  2. Der falsche Encryptor liest (z. B. CSFLE gegen App-Crypto-Daten) → rohe
//     Bytes mit vielen Steuer-/Ersatzzeichen.
export function siehtVerschluesseltAus(wert: string): boolean {
  if (!wert) return false
  // Fall 1: unser Ciphertext-Format. IV (12 Byte → 16 Zeichen) und Auth-Tag
  // (16 Byte → 24 Zeichen) haben feste Längen — das ist die verlässliche
  // Signatur. Das Datensegment bleibt offen, es ist bei kurzen Werten nur
  // wenige Zeichen lang. Die festen Längen verhindern zugleich, dass harmlose
  // Werte mit Doppelpunkten (etwa „12:30:00") anschlagen.
  if (/^[A-Za-z0-9+/=]{16}:[A-Za-z0-9+/=]{24}:[A-Za-z0-9+/=]+$/.test(wert)) return true
  // Fall 2: überwiegend nicht darstellbare Zeichen.
  const lesbar = [...wert].filter((c) => /[\p{L}\p{N}\p{P}\p{Zs}]/u.test(c)).length
  return lesbar / [...wert].length < 0.9
}

// Reine Bewertung des Leseergebnisses. Der Probewert wird hier ausgewertet und
// verlässt die Funktion nicht — nach außen geht nur der Modus, denn der
// Health-Endpoint, der ihn ausliefert, ist öffentlich.
export function bewerteKrypto(input: {
  gefunden: boolean
  probewert?: unknown
  fehlgeschlagen?: boolean
}): KryptoStatus {
  // Ein Fehler beim Lesen ist der klassische Fall „falscher Schlüssel": die
  // afterRead-Hooks werfen beim Entschlüsseln.
  if (input.fehlgeschlagen) return { modus: 'schluesselFehler' }
  if (!input.gefunden) return { modus: 'keineDaten' }
  const wert = input.probewert
  if (typeof wert !== 'string' || wert.length === 0) return { modus: 'schluesselFehler' }
  return { modus: siehtVerschluesseltAus(wert) ? 'schluesselFehler' : 'ok' }
}
