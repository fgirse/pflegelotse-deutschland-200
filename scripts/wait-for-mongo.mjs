// Wartet, bis das MongoDB-Replica-Set Schreibvorgänge annimmt.
// Nutzt den nativen Treiber, damit kein mongosh nötig ist.
import { MongoClient } from 'mongodb'

const uri =
  process.env.DATABASE_URI ||
  'mongodb://localhost:27017/pflege_dev?replicaSet=rs0&directConnection=true'

const deadline = Date.now() + 60_000
let lastErr

while (Date.now() < deadline) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 })
  try {
    await client.connect()
    // `hello` allein beweist nur, dass der Server ANTWORTET. Beim ersten
    // Hochfahren initiiert der Compose-Healthcheck das Replica-Set erst — bis
    // zur Wahl ist der Knoten weder Primary noch Secondary und lehnt jeden
    // Schreibvorgang mit NotPrimaryOrSecondary ab. Deshalb warten wir explizit
    // auf isWritablePrimary, sonst scheitert das direkt folgende db:init.
    const hello = await client.db('admin').command({ hello: 1 })
    if (!hello.isWritablePrimary) {
      throw new Error(`Replica-Set noch nicht wählbar (Status: ${hello.setName ?? 'kein RS'})`)
    }
    await client.close()
    console.log('MongoDB-Replica-Set ist bereit (Primary, schreibfähig).')
    process.exit(0)
  } catch (e) {
    lastErr = e
    await client.close().catch(() => {})
    await new Promise((r) => setTimeout(r, 2000))
  }
}

console.error('MongoDB nicht erreichbar:', lastErr?.message)
process.exit(1)
