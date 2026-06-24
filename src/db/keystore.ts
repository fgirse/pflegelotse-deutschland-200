import type { KeyStore } from '@/lib/encryption'
import { getDb } from './mongo'

// MongoDB-gestützter Schlüsselspeicher: hält die umschlossenen pro-Klient-DEKs
// in der Collection `klienten_keys`. Bewusst getrennt von Säule 1 und 2.
// deleteDek() ist der Crypto-Shredding-Hebel (Art. 17): danach sind die
// zugehörigen Säule-1-Felder unumkehrbar unlesbar.
export class MongoKeyStore implements KeyStore {
  private async col() {
    const db = await getDb()
    return db.collection<{ pseudonym_id: string; wrapped: string }>('klienten_keys')
  }

  async getWrappedDek(pseudonymId: string): Promise<string | null> {
    const doc = await (await this.col()).findOne({ pseudonym_id: pseudonymId })
    return doc?.wrapped ?? null
  }

  async putWrappedDekIfAbsent(pseudonymId: string, wrapped: string): Promise<void> {
    // $setOnInsert + upsert: schreibt nur beim ersten Mal. Der eindeutige
    // Index auf pseudonym_id macht gleichzeitige Inserts unschädlich.
    await (await this.col()).updateOne(
      { pseudonym_id: pseudonymId },
      { $setOnInsert: { wrapped } },
      { upsert: true },
    )
  }

  async deleteDek(pseudonymId: string): Promise<void> {
    await (await this.col()).deleteOne({ pseudonym_id: pseudonymId })
  }
}
