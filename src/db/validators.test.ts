import { describe, it, expect, afterAll } from 'vitest'
import { MongoClient, type Db } from 'mongodb'
import { applyValidators } from './validators'

// Integrationstest gegen eine echte MongoDB. Prüft die PII-Sperre der Säule 2
// (Blocker-Klasse: ein PII-Leck in Säule 2 sperrt den Go-Live). Überspringt
// sich, wenn keine DB erreichbar ist (z. B. CI ohne `pnpm run db:up`).
//
// WICHTIG: Die Verfügbarkeit wird per Top-Level-await VOR der Testdefinition
// ermittelt, weil it.skipIf() seine Bedingung bereits beim Laden auswertet.
const uri =
  process.env.DATABASE_URI ||
  'mongodb://localhost:27018/pflege_test?replicaSet=rs0&directConnection=true'

const gueltigeUuid = '11111111-1111-4111-8111-111111111111'

let client: MongoClient | undefined
let db: Db | undefined
let verfuegbar = false

try {
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 1500 })
  await client.connect()
  await client.db().command({ ping: 1 })
  db = client.db()
  await applyValidators(db)
  verfuegbar = true
} catch (e) {
  console.error('validators.test übersprungen:', (e as Error).message)
  verfuegbar = false
}

const bedarfUuid = '22222222-2222-4222-8222-222222222222'

afterAll(async () => {
  if (db) {
    await db.collection('klienten_operativ').deleteMany({ tenantId: 'test-tenant' })
    await db.collection('bedarfe').deleteMany({ pseudonymId: bedarfUuid })
  }
  await client?.close()
})

describe('Säule-2-PII-Sperre ($jsonSchema)', () => {
  it.skipIf(!verfuegbar)('weist einen Schreibversuch mit Klarnamen ab', async () => {
    const col = db!.collection('klienten_operativ')
    await expect(
      col.insertOne({
        pseudonymId: gueltigeUuid,
        tenantId: 'test-tenant',
        geo: { lat: 48.0, lng: 7.8 },
        status: 'aktiv',
        // PII — muss serverseitig abgewiesen werden:
        vorname: 'Max',
        nachname: 'Mustermann',
        adresse: 'Musterstr. 1',
      }),
    ).rejects.toThrow()
  })

  it.skipIf(!verfuegbar)('akzeptiert einen sauberen, pseudonymen Datensatz', async () => {
    const col = db!.collection('klienten_operativ')
    const res = await col.insertOne({
      pseudonymId: gueltigeUuid,
      tenantId: 'test-tenant',
      geo: { lat: 48.0, lng: 7.8 },
      pflegegrad: 3,
      status: 'aktiv',
    })
    expect(res.acknowledged).toBe(true)
  })

  it.skipIf(!verfuegbar)('lehnt eine ungültige pseudonym_id ab (keine UUIDv4)', async () => {
    const col = db!.collection('klienten_operativ')
    await expect(
      col.insertOne({
        pseudonymId: 'nicht-uuid',
        tenantId: 'test-tenant',
        geo: { lat: 48.0, lng: 7.8 },
        status: 'aktiv',
      }),
    ).rejects.toThrow()
  })
})

describe('Marktplatz-Bedarfe-PII-Sperre ($jsonSchema)', () => {
  it.skipIf(!verfuegbar)('weist PII in einem Bedarf ab', async () => {
    const col = db!.collection('bedarfe')
    await expect(
      col.insertOne({
        pseudonymId: bedarfUuid,
        geo: { lat: 48.0, lng: 7.8 },
        status: 'offen',
        // PII — muss abgewiesen werden:
        nachname: 'Schneider',
        telefon: '0761-123456',
      }),
    ).rejects.toThrow()
  })

  it.skipIf(!verfuegbar)('akzeptiert einen sauberen, anonymen Bedarf', async () => {
    const col = db!.collection('bedarfe')
    const res = await col.insertOne({
      pseudonymId: bedarfUuid,
      geo: { lat: 48.0, lng: 7.8 },
      status: 'offen',
    })
    expect(res.acknowledged).toBe(true)
  })

  it.skipIf(!verfuegbar)('lehnt einen unbekannten Status ab', async () => {
    const col = db!.collection('bedarfe')
    await expect(
      col.insertOne({ pseudonymId: bedarfUuid, geo: { lat: 48.0, lng: 7.8 }, status: 'foo' }),
    ).rejects.toThrow()
  })
})
