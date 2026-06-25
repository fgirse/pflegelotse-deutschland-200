import { describe, it, expect, vi, afterEach } from 'vitest'
import { OsrmRoutingProvider } from './OsrmRoutingProvider'
import { FallbackRoutingProvider } from './FallbackRoutingProvider'
import { HaversineRoutingProvider } from './HaversineRoutingProvider'
import type { Geo } from '@/shared/domain'

// Drei Punkte in Freiburg; Werte irrelevant, nur die URL-Bildung zählt.
const punkte: Geo[] = [
  { lat: 48.0, lng: 7.85 },
  { lat: 48.01, lng: 7.86 },
  { lat: 48.02, lng: 7.84 },
]

// Hilfsfunktion: gemockte fetch-Antwort mit OSRM-typischem Body (Sekunden).
function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as Response)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OsrmRoutingProvider', () => {
  it('baut die table-URL mit lng,lat-Reihenfolge und rechnet Sekunden in Minuten um', async () => {
    const fetchMock = mockFetch({
      code: 'Ok',
      durations: [
        [0, 600, 1200],
        [600, 0, 300],
        [1200, 300, 0],
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    const osrm = new OsrmRoutingProvider('https://osrm.example.org/', 'driving')
    const m = await osrm.travelMatrix(punkte)

    // URL: Länge vor Breite, Semikolon-getrennt, annotations=duration.
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toBe(
      'https://osrm.example.org/table/v1/driving/7.85,48;7.86,48.01;7.84,48.02?annotations=duration',
    )
    // 600 s → 10 min, 1200 s → 20 min, 300 s → 5 min.
    expect(m[0][1]).toBe(10)
    expect(m[0][2]).toBe(20)
    expect(m[1][2]).toBe(5)
  })

  it('sendet den X-Api-Key-Header, wenn ein Schlüssel gesetzt ist', async () => {
    const fetchMock = mockFetch({ code: 'Ok', durations: [[0, 60], [60, 0]] })
    vi.stubGlobal('fetch', fetchMock)
    const osrm = new OsrmRoutingProvider('https://osrm.example.org', 'driving', 'geheim123')
    await osrm.travelMatrix([punkte[0], punkte[1]])
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('geheim123')
  })

  it('sendet ohne Schlüssel keinen Auth-Header', async () => {
    const fetchMock = mockFetch({ code: 'Ok', durations: [[0, 60], [60, 0]] })
    vi.stubGlobal('fetch', fetchMock)
    const osrm = new OsrmRoutingProvider('https://osrm.example.org')
    await osrm.travelMatrix([punkte[0], punkte[1]])
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.headers).toBeUndefined()
  })

  it('behandelt nicht erreichbare Paare (null) als unendlich weit', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ code: 'Ok', durations: [[0, null], [null, 0]] }),
    )
    const osrm = new OsrmRoutingProvider('https://osrm.example.org')
    const m = await osrm.travelMatrix([punkte[0], punkte[1]])
    expect(m[0][1]).toBe(Infinity)
  })

  it('wirft bei HTTP-Fehler', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false, 502))
    const osrm = new OsrmRoutingProvider('https://osrm.example.org')
    await expect(osrm.travelMatrix(punkte)).rejects.toThrow(/502/)
  })

  it('wirft bei OSRM-Fehlercode', async () => {
    vi.stubGlobal('fetch', mockFetch({ code: 'NoSegment' }))
    const osrm = new OsrmRoutingProvider('https://osrm.example.org')
    await expect(osrm.travelMatrix(punkte)).rejects.toThrow(/NoSegment/)
  })

  it('ruft fetch bei 0/1 Punkt gar nicht erst auf', async () => {
    const fetchMock = mockFetch({ code: 'Ok', durations: [[0]] })
    vi.stubGlobal('fetch', fetchMock)
    const osrm = new OsrmRoutingProvider('https://osrm.example.org')
    expect(await osrm.travelMatrix([])).toEqual([])
    expect(await osrm.travelMatrix([punkte[0]])).toEqual([[0]])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('FallbackRoutingProvider', () => {
  it('fällt bei Fehler des primären Providers auf den Ersatz zurück', async () => {
    const kaputt = {
      travelMatrix: vi.fn().mockRejectedValue(new Error('OSRM down')),
    }
    const ersatz = new HaversineRoutingProvider()
    const fb = new FallbackRoutingProvider(kaputt, ersatz)

    const m = await fb.travelMatrix(punkte)
    // Haversine liefert eine vollständige, symmetrische, endliche Matrix.
    expect(m).toHaveLength(3)
    expect(m[0][1]).toBeGreaterThan(0)
    expect(m[0][1]).toBe(m[1][0])
    expect(kaputt.travelMatrix).toHaveBeenCalledOnce()
  })

  it('reicht das Ergebnis des primären Providers durch, wenn er funktioniert', async () => {
    const primaer = {
      travelMatrix: vi.fn().mockResolvedValue([[0, 7], [7, 0]]),
    }
    const ersatz = { travelMatrix: vi.fn() }
    const fb = new FallbackRoutingProvider(primaer, ersatz)
    const m = await fb.travelMatrix([punkte[0], punkte[1]])
    expect(m).toEqual([[0, 7], [7, 0]])
    expect(ersatz.travelMatrix).not.toHaveBeenCalled()
  })
})
