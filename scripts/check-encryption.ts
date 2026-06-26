// Prüft, ob der konfigurierte ENCRYPTION_MASTER_KEY die bestehenden
// Säule-1-Daten (Klienten-Identitäten) entschlüsseln kann. Wichtig nach
// Umgebungswechseln: passt der Schlüssel in der Umgebung NICHT zu den Daten,
// schlägt das Entschlüsseln fehl und das Dashboard zeigt keine Namen.
//
// Aufruf:  pnpm run check:encryption
import { getPayload } from 'payload'
import config from '../src/payload.config'

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
    const lesbar = typeof doc.vorname === 'string' && doc.vorname.length > 0
    if (lesbar) {
      console.log('✓ OK: Entschlüsselung erfolgreich — der Schlüssel passt zu den Daten.')
      process.exit(0)
    }
    console.log('⚠ Vorname leer/unlesbar — Schlüssel passt möglicherweise nicht.')
    process.exit(1)
  } catch (e) {
    console.error(
      '✗ Entschlüsselung fehlgeschlagen — ENCRYPTION_MASTER_KEY passt vermutlich nicht zu den vorhandenen Daten:',
      e instanceof Error ? e.message : e,
    )
    process.exit(1)
  }
}

main()
