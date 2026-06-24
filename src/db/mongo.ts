import { MongoClient, type Db } from 'mongodb'
import { env } from '@/lib/env'

// Geteilter nativer MongoDB-Client. Payload bringt seinen eigenen Treiber
// mit; diesen hier nutzen wir für Dinge, die außerhalb von Payload laufen:
// $jsonSchema-Validatoren (db:init), Indizes, Schlüsselspeicher, Audit-Log.
// Der Client wird über Hot-Reloads hinweg wiederverwendet.
const globalForMongo = globalThis as unknown as { _mongoClient?: MongoClient }

export async function getMongo(): Promise<MongoClient> {
  if (!globalForMongo._mongoClient) {
    const client = new MongoClient(env.DATABASE_URI)
    await client.connect()
    globalForMongo._mongoClient = client
  }
  return globalForMongo._mongoClient
}

export async function getDb(): Promise<Db> {
  const client = await getMongo()
  // Datenbankname steckt in der URI; default() nimmt ihn von dort.
  return client.db()
}
