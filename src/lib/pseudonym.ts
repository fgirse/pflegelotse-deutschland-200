import { randomUUID } from 'node:crypto'

// Die pseudonym_id ist die EINZIGE Verknüpfung zwischen Säule 1 (Identität)
// und Säule 2 (operative Daten) — eine zufällige UUIDv4 (/D600/).
// Aus ihr lässt sich kein Personenbezug ableiten.
export function neuePseudonymId(): string {
  return randomUUID()
}

// UUIDv4-Muster, identisch zum serverseitigen $jsonSchema-Validator.
// Wird auch in der App-Schicht genutzt, um früh zu prüfen.
export const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function istPseudonymId(wert: string): boolean {
  return UUID_V4_PATTERN.test(wert)
}
