import { describe, it, expect } from 'vitest'
import { umverteile } from './umverteilung'
import { HaversineRoutingProvider } from '@/server/routing/HaversineRoutingProvider'
import type { Tour, Einsatz } from '@/shared/domain'

// Echtes Haversine-Routing über die Geo-Koordinaten (deterministisch), damit die
// Zuordnung „näher = günstiger" ohne feste Matrix-Größe funktioniert.
const routing = new HaversineRoutingProvider()

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const weit = { von: 480, bis: 960 }

// West-Cluster ~7.80, Ost-Cluster ~7.90 (Breite konstant 48.00).
const WEST = { lat: 48.0, lng: 7.8 }
const OST = { lat: 48.0, lng: 7.9 }

function einsatz(n: number, geo: { lat: number; lng: number }, over: Partial<Einsatz> = {}): Einsatz {
  return { pseudonymId: uid(n), geo, zeitfenster: weit, dauerMin: 30, qualifikation: [], ...over }
}

function tour(id: string, geo: { lat: number; lng: number }, over: Partial<Tour> = {}): Tour {
  return {
    id,
    tenantId: 'demo',
    datum: '2026-07-25',
    pflegekraftId: `pk-${id}`,
    pflegekraftQualifikation: ['grundpflege'],
    start: geo,
    startZeit: 480,
    einsaetze: [einsatz(Number(id.replace(/\D/g, '')) * 100, geo)],
    ...over,
  }
}

describe('umverteile (Multi-Vehicle-Umverteilung)', () => {
  it('verteilt verwaiste Einsätze auf die geografisch günstigste Tour', async () => {
    const zielWest = tour('1', WEST)
    const zielOst = tour('2', OST)
    // Verwaiste Einsätze: einer im Westen, einer im Osten.
    const verwaiste = [einsatz(9001, { lat: 48.0, lng: 7.805 }), einsatz(9002, { lat: 48.0, lng: 7.895 })]

    const res = await umverteile(verwaiste, [zielWest, zielOst], routing)

    expect(res.nichtPlatzierbar).toHaveLength(0)
    expect(res.zuordnungen).toHaveLength(2)
    const west = res.zuordnungen.find((z) => z.pseudonymId === uid(9001))!
    const ost = res.zuordnungen.find((z) => z.pseudonymId === uid(9002))!
    expect(west.zielTourId).toBe('1') // West-Einsatz → West-Tour
    expect(ost.zielTourId).toBe('2') // Ost-Einsatz → Ost-Tour
  })

  it('markiert einen Einsatz ohne passende Qualifikation als nicht platzierbar', async () => {
    const zielWest = tour('1', WEST) // nur grundpflege
    const verwaiste = [einsatz(9003, WEST, { qualifikation: ['behandlungspflege'] })]

    const res = await umverteile(verwaiste, [zielWest], routing)

    expect(res.zuordnungen).toHaveLength(0)
    expect(res.nichtPlatzierbar).toEqual([{ pseudonymId: uid(9003), grund: 'qualifikation' }])
  })

  it('respektiert die Kapazitätsgrenze einer Zieltour (weicht auf andere aus)', async () => {
    // West-Tour ist voll (maxEinsaetze = 1, schon 1 Einsatz). Der West-Einsatz
    // muss auf die Ost-Tour ausweichen, statt West zu überbuchen.
    const zielWest = tour('1', WEST, { maxEinsaetze: 1 })
    const zielOst = tour('2', OST)
    const verwaiste = [einsatz(9004, { lat: 48.0, lng: 7.805 })]

    const res = await umverteile(verwaiste, [zielWest, zielOst], routing)

    expect(res.nichtPlatzierbar).toHaveLength(0)
    expect(res.zuordnungen[0].zielTourId).toBe('2') // ausgewichen auf Ost
  })

  it('Invariante: jeder verwaiste Einsatz taucht genau einmal auf', async () => {
    const zielWest = tour('1', WEST)
    const verwaiste = [
      einsatz(9101, WEST),
      einsatz(9102, OST),
      einsatz(9103, WEST, { qualifikation: ['behandlungspflege'] }), // nicht platzierbar
    ]
    const res = await umverteile(verwaiste, [zielWest], routing)

    const gesehen = [
      ...res.zuordnungen.map((z) => z.pseudonymId),
      ...res.nichtPlatzierbar.map((n) => n.pseudonymId),
    ].sort()
    expect(gesehen).toEqual([uid(9101), uid(9102), uid(9103)].sort())
    expect(new Set(gesehen).size).toBe(3) // keine Dublette
  })
})
