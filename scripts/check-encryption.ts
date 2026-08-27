// Prüft, ob der konfigurierte ENCRYPTION_MASTER_KEY die bestehenden
// Säule-1-Daten (Klienten-Identitäten) entschlüsseln kann. Wichtig nach
// Umgebungswechseln: passt der Schlüssel in der Umgebung NICHT zu den Daten,
// schlägt das Entschlüsseln fehl und das Dashboard zeigt keine Namen.
//
// Aufruf:  pnpm run check:encryption
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { siehtVerschluesseltAus } from '../src/server/identity/kryptoStatus'

async function main() {
  const payload = await getPayload({ config })
  try {
    // afterRead-Hooks entschlüsseln die PII-Felder; wirft bei falschem Schlüssel.
    const res = await payload.find({
      collection: 'klienten_identitaet',
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })
    const doc = res.docs[0] as { vorname?: string } | undefined
    if (!doc) {
      console.log('Keine Klienten-Identität vorhanden — nichts zu prüfen (das ist ok).')
      process.exit(0)
    }
    // Ein „nicht leer"-Test genügt NICHT: Bleibt der Wert unentschlüsselt, ist
    // er ebenfalls ein nicht-leerer String — der App-Crypto-Ciphertext
    // (iv:tag:data) besteht sogar ausschließlich aus druckbaren Zeichen. Genau
    // deshalb meldete diese Prüfung früher fälschlich OK.
    if (typeof doc.vorname !== 'string' || doc.vorname.length === 0) {
      console.log('⚠ Vorname leer — Schlüssel passt möglicherweise nicht.')
      process.exit(1)
    }
    if (siehtVerschluesseltAus(doc.vorname)) {
      console.error(
        '✗ FEHLER: Der gelesene Wert ist noch verschlüsselt.\n' +
          '  Mögliche Ursachen: falscher ENCRYPTION_MASTER_KEY, oder CSFLE_ENABLED\n' +
          '  passt nicht zu dem Verfahren, mit dem die Daten geschrieben wurden.',
      )
      process.exit(1)
    }
    console.log('✓ OK: Entschlüsselung erfolgreich — der Schlüssel passt zu den Daten.')
    process.exit(0)
  } catch (e) {
    console.error(
      '✗ Entschlüsselung fehlgeschlagen — ENCRYPTION_MASTER_KEY passt vermutlich nicht zu den vorhandenen Daten:',
      e instanceof Error ? e.message : e,
    )
    process.exit(1)
  }
}

main()
