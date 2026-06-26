// Setzt die Disponenten-Demodaten des Mandanten "demo" zurück: löscht Klienten
// (Säule 1 + 2), Touren und die zugehörigen Krypto-Schlüssel (Crypto-Shredding
// über den offiziellen KeyStore). `pnpm run db:reset` seedet danach automatisch
// neu (siehe package.json) — Ergebnis: der kanonische Demo-Stand.
//
// Hinweis: betrifft NUR die Disponenten-Demodaten, nicht den Marktplatz.
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { MongoKeyStore } from '../src/db/keystore'

const TENANT = 'demo'

async function main() {
  const payload = await getPayload({ config })

  // pseudonymIds der Demo-Klienten einsammeln (für Schlüssel-Löschung).
  const op = await payload.find({
    collection: 'klienten_operativ',
    where: { tenantId: { equals: TENANT } },
    limit: 1000,
    overrideAccess: true,
    depth: 0,
  })
  const ids = (op.docs as { pseudonymId?: string }[])
    .map((d) => d.pseudonymId)
    .filter((x): x is string => Boolean(x))
  console.log(`Demo-Klienten gefunden: ${ids.length}`)

  // Crypto-Shredding: pro Klient den umschlossenen DEK löschen.
  const keystore = new MongoKeyStore()
  let keys = 0
  for (const id of ids) {
    await keystore.deleteDek(id)
    keys++
  }
  console.log(`Krypto-Schlüssel gelöscht: ${keys}`)

  // Beide Säulen + Touren des Mandanten entfernen.
  await payload.delete({ collection: 'touren', where: { tenantId: { equals: TENANT } }, overrideAccess: true })
  await payload.delete({ collection: 'klienten_operativ', where: { tenantId: { equals: TENANT } }, overrideAccess: true })
  await payload.delete({ collection: 'klienten_identitaet', where: { tenantId: { equals: TENANT } }, overrideAccess: true })

  console.log('Demodaten gelöscht — Seeden folgt …')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
