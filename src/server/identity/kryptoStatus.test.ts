import { describe, it, expect } from 'vitest'
import { bewerteKrypto } from './kryptoStatus'

describe('bewerteKrypto', () => {
  it('meldet ok, wenn ein Klartextfeld herauskommt', () => {
    expect(bewerteKrypto({ gefunden: true, vornameLesbar: true })).toEqual({ modus: 'ok' })
  })

  it('meldet einen Schlüsselfehler, wenn das Lesen wirft', () => {
    // Der klassische Fall: die afterRead-Hooks werfen beim Entschlüsseln, weil
    // der ENCRYPTION_MASTER_KEY nicht zu den gespeicherten Daten passt.
    expect(bewerteKrypto({ gefunden: true, vornameLesbar: false, fehlgeschlagen: true })).toEqual({
      modus: 'schluesselFehler',
    })
  })

  it('meldet einen Schlüsselfehler auch bei leisem Fehlschlag (Feld bleibt leer)', () => {
    // Nicht jeder falsche Schlüssel wirft — manche Pfade liefern einfach nichts
    // zurück. Das darf nicht als „ok" durchgehen, sonst ist der Selbsttest wertlos.
    expect(bewerteKrypto({ gefunden: true, vornameLesbar: false })).toEqual({
      modus: 'schluesselFehler',
    })
  })

  it('unterscheidet „noch keine Daten" von einem Schlüsselproblem', () => {
    // Eine frische Umgebung ohne Identitäten ist kein Störfall — sonst stünde
    // jede neue Installation sofort auf „degraded".
    expect(bewerteKrypto({ gefunden: false, vornameLesbar: false })).toEqual({
      modus: 'keineDaten',
    })
  })
})
