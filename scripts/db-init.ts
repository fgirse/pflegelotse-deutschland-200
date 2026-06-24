// Legt die $jsonSchema-Validatoren und Indizes an. Idempotent.
// Aufruf: pnpm run db:init (setzt ein laufendes Replica-Set voraus).
// Env wird per `node --env-file=.env` geladen (siehe package.json).
import { MongoClient } from 'mongodb'
import { applyValidators } from '../src/db/validators'

async function main() {
  const uri = process.env.DATABASE_URI
  if (!uri) throw new Error('DATABASE_URI fehlt — bitte zuerst `pnpm run setup`.')

  const client = new MongoClient(uri)
  await client.connect()
  try {
    await applyValidators(client.db())
    console.log('Validatoren und Indizes angewendet (Säule 2 PII-Sperre aktiv).')
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
