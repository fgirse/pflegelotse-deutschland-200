import { describe, it, expect, vi, afterEach } from 'vitest'
import { NominatimGeocoder } from './NominatimGeocoder'

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as Response)
}

afterEach(() => vi.restoreAllMocks())

describe('NominatimGeocoder', () => {
  it('liefert gerundete Koordinaten + Anzeigename und baut die search-URL', async () => {
    const fetchMock = mockFetch([
      { lat: '47.9871234', lon: '7.8509876', display_name: 'Wiehre, Freiburg' },
    ])
    vi.stubGlobal('fetch', fetchMock)
    const g = new NominatimGeocoder('https://nominatim.example.org/', 'Test/1.0')
    const r = await g.geocode('Wiehre Freiburg')
    expect(r).toEqual({ lat: 47.987, lng: 7.851, displayName: 'Wiehre, Freiburg' })
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('https://nominatim.example.org/search?')
    expect(url).toContain('countrycodes=de')
    // User-Agent-Header gesetzt (Policy).
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('Test/1.0')
  })

  it('gibt null zurück, wenn kein Treffer', async () => {
    vi.stubGlobal('fetch', mockFetch([]))
    const g = new NominatimGeocoder('https://nominatim.example.org', 'Test/1.0')
    expect(await g.geocode('asdfqwer')).toBeNull()
  })

  it('wirft bei HTTP-Fehler', async () => {
    vi.stubGlobal('fetch', mockFetch([], false, 429))
    const g = new NominatimGeocoder('https://nominatim.example.org', 'Test/1.0')
    await expect(g.geocode('x')).rejects.toThrow(/429/)
  })
})
