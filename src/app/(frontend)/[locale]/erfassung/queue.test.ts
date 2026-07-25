import { describe, it, expect, vi } from 'vitest'
import { enqueue, flushQueue, type ErfassungAktion } from './queue'

const aktion = (id: string, over: Partial<ErfassungAktion> = {}): ErfassungAktion => ({
  aktionId: id,
  tourId: 'T1',
  pseudonymId: 'p1',
  event: 'ankunft',
  ...over,
})

describe('Offline-Queue', () => {
  it('enqueue ignoriert Aktionen mit bereits vorhandener aktionId', () => {
    let q: ErfassungAktion[] = []
    q = enqueue(q, aktion('a'))
    q = enqueue(q, aktion('a')) // Duplikat
    q = enqueue(q, aktion('b'))
    expect(q.map((a) => a.aktionId)).toEqual(['a', 'b'])
  })

  it('flushQueue entfernt gesendete und behält fehlgeschlagene (in Reihenfolge)', async () => {
    const q = [aktion('a'), aktion('b'), aktion('c')]
    // b schlägt fehl (offline/Fehler), a und c gehen durch.
    const senden = vi.fn(async (x: ErfassungAktion) => x.aktionId !== 'b')
    const { verbleibend, gesendet } = await flushQueue(q, senden)
    expect(gesendet).toBe(2)
    expect(verbleibend.map((a) => a.aktionId)).toEqual(['b'])
    expect(senden).toHaveBeenCalledTimes(3)
  })

  it('flushQueue behält Aktionen, wenn senden wirft (kein Verlust)', async () => {
    const q = [aktion('a')]
    const { verbleibend, gesendet } = await flushQueue(q, async () => {
      throw new Error('offline')
    })
    expect(gesendet).toBe(0)
    expect(verbleibend).toHaveLength(1)
  })
})
