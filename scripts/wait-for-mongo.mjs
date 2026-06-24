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
    // Ein Ping als Primary beweist, dass das Replica-Set wählbar ist.
    await client.db('admin').command({ hello: 1 })
    await client.close()
    console.log('MongoDB-Replica-Set ist bereit.')
    process.exit(0)
  } catch (e) {
    lastErr = e
    await client.close().catch(() => {})
    await new Promise((r) => setTimeout(r, 2000))
  }
}

console.error('MongoDB nicht erreichbar:', lastErr?.message)
process.exit(1)
