import { describe, it, expect } from 'vitest'
import { createCipheriv, randomBytes } from 'node:crypto'
import { bewerteKrypto, siehtVerschluesseltAus } from './kryptoStatus'

// Erzeugt einen Ciphertext im echten Projektformat (iv:tag:data, alles Base64)
// — nicht nachgebaut, sondern mit derselben Konstruktion wie lib/encryption.ts.
function echterCiphertext(klartext: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', randomBytes(32), iv)
  const enc = Buffer.concat([c.update(klartext, 'utf8'), c.final()])
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':')
}

describe('siehtVerschluesseltAus', () => {
  it('erkennt den App-Crypto-Ciphertext, obwohl er vollständig druckbar ist', () => {
    // Der Kern des Problems: Dieser Wert besteht nur aus Base64 und
    // Doppelpunkten. Jede „sieht der Text lesbar aus?"-Heuristik hält ihn für
    // Klartext — und genau so ging der Fehler vorher durch.
    for (const klar of ['Anna', 'A', 'Müller-Lüdenscheidt', 'Habsburgerstr. 1, 79104 Freiburg']) {
      expect(siehtVerschluesseltAus(echterCiphertext(klar)), `für "${klar}"`).toBe(true)
    }
  })

  it('erkennt rohe Bytes (falscher Encryptor gelesen)', () => {
    // Entsteht, wenn CSFLE gegen App-Crypto-Daten liest.
    expect(siehtVerschluesseltAus(randomBytes(24).toString('binary'))).toBe(true)
  })

  it('hält echten Klartext für Klartext — auch mit Umlauten und Satzzeichen', () => {
    for (const s of [
      'Anna',
      'Müller-Lüdenscheidt',
      'Habsburgerstr. 1, 79104 Freiburg',
      'St. Georgen',
      "O'Brien",
    ]) {
      expect(siehtVerschluesseltAus(s), `für "${s}"`).toBe(false)
    }
  })

  it('schlägt bei harmlosen Werten mit Doppelpunkten nicht an', () => {
    expect(siehtVerschluesseltAus('12:30:00')).toBe(false)
    expect(siehtVerschluesseltAus('Termin: 8:00')).toBe(false)
  })
})

describe('bewerteKrypto', () => {
  it('meldet ok für echten Klartext', () => {
    expect(bewerteKrypto({ gefunden: true, probewert: 'Anna' })).toEqual({ modus: 'ok' })
  })

  it('meldet schluesselFehler für einen unentschlüsselten Wert', () => {
    // Der Regressionstest für den eigentlichen Fehler: Vorher meldete diese
    // Konstellation „ok", weil nur auf einen nicht-leeren String geprüft wurde.
    expect(bewerteKrypto({ gefunden: true, probewert: echterCiphertext('Anna') })).toEqual({
      modus: 'schluesselFehler',
    })
  })

  it('meldet einen Schlüsselfehler, wenn das Lesen wirft', () => {
    expect(bewerteKrypto({ gefunden: true, fehlgeschlagen: true })).toEqual({
      modus: 'schluesselFehler',
    })
  })

  it('meldet einen Schlüsselfehler bei leerem oder fehlendem Wert', () => {
    expect(bewerteKrypto({ gefunden: true, probewert: '' })).toEqual({ modus: 'schluesselFehler' })
    expect(bewerteKrypto({ gefunden: true, probewert: null })).toEqual({
      modus: 'schluesselFehler',
    })
  })

  it('unterscheidet „noch keine Daten" von einem Schlüsselproblem', () => {
    // Eine frische Umgebung ohne Identitäten ist kein Störfall — sonst stünde
    // jede neue Installation sofort auf „degraded".
    expect(bewerteKrypto({ gefunden: false })).toEqual({ modus: 'keineDaten' })
  })
})
