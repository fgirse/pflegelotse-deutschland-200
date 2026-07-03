import { describe, it, expect, vi, afterEach } from 'vitest'
import { HereRoutingProvider } from './HereRoutingProvider'
import type { Geo } from '@/shared/domain'

// Drei Punkte in Freiburg; Werte für die Assertion des Request-Bodys.
const punkte: Geo[] = [
  { lat: 48.0, lng: 7.85 },
  { lat: 48.01, lng: 7.86 },
  { lat: 48.02, lng: 7.84 },
]

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as Response)
}

// Feste „Jetzt"-Zeit für einen deterministischen departureTime im Body.
const festeZeit = () => new Date('2026-07-03T08:00:00.000Z')

afterEach(() => vi.restoreAllMocks())

describe('HereRoutingProvider', () => {
  it('baut die Matrix-Anfrage mit Verkehrszeit und rechnet Sekunden in Minuten um', async () => {
    // Flaches travelTimes[i*3+j] in Sekunden (3×3).
    const fetchMock = mockFetch({
      matrix: {
        numOrigins: 3,
        numDestinations: 3,
        travelTimes: [0, 600, 1200, 600, 0, 300, 1200, 300, 0],
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const here = new HereRoutingProvider('geheim-key', 'car', 4000, festeZeit)
    const m = await here.travelMatrix(punkte)

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('matrix.router.hereapi.com/v8/matrix')
    expect(url).toContain('async=false')
    expect(url).toContain('apiKey=geheim-key')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.transportMode).toBe('car')
    expect(body.departureTime).toBe('2026-07-03T08:00:00.000Z') // Verkehrsdaten
    expect(body.origins).toHaveLength(3)
    expect(body.origins[0]).toEqual({ lat: 48.0, lng: 7.85 })

    // 600 s → 10 min, 1200 s → 20 min, 300 s → 5 min.
    expect(m[0][1]).toBe(10)
    expect(m[0][2]).toBe(20)
    expect(m[1][2]).toBe(5)
  })

  it('behandelt nicht erreichbare Paare (errorCodes != 0) als unendlich weit', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        matrix: { numOrigins: 2, numDestinations: 2, travelTimes: [0, 0, 0, 0], errorCodes: [0, 3, 3, 0] },
      }),
    )
    const here = new HereRoutingProvider('k')
    const m = await here.travelMatrix([punkte[0], punkte[1]])
    expect(m[0][1]).toBe(Infinity)
    expect(m[1][0]).toBe(Infinity)
    expect(m[0][0]).toBe(0)
  })

  it('wirft bei HTTP-Fehler (Fallback greift dann außerhalb)', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false, 429))
    const here = new HereRoutingProvider('k')
    await expect(here.travelMatrix(punkte)).rejects.toThrow(/429/)
  })

  it('wirft ohne travelTimes in der Antwort', async () => {
    vi.stubGlobal('fetch', mockFetch({ matrix: { numOrigins: 2, numDestinations: 2 } }))
    const here = new HereRoutingProvider('k')
    await expect(here.travelMatrix([punkte[0], punkte[1]])).rejects.toThrow(/travelTimes/)
  })

  it('wirft über dem Sync-Limit (15 Origins) — Fallback übernimmt', async () => {
    const fetchMock = mockFetch({ matrix: { numOrigins: 16, numDestinations: 16, travelTimes: [] } })
    vi.stubGlobal('fetch', fetchMock)
    const viele: Geo[] = Array.from({ length: 16 }, (_, i) => ({ lat: 48 + i / 100, lng: 7.8 + i / 100 }))
    const here = new HereRoutingProvider('k')
    await expect(here.travelMatrix(viele)).rejects.toThrow(/Sync-Limit/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ruft fetch bei 0/1 Punkt gar nicht erst auf', async () => {
    const fetchMock = mockFetch({ matrix: { numOrigins: 1, numDestinations: 1, travelTimes: [0] } })
    vi.stubGlobal('fetch', fetchMock)
    const here = new HereRoutingProvider('k')
    expect(await here.travelMatrix([])).toEqual([])
    expect(await here.travelMatrix([punkte[0]])).toEqual([[0]])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
