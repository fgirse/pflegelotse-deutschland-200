import { describe, it, expect, vi, afterEach } from 'vitest'
import { waehleRoutingKern, type RoutingKonfig } from './waehleRouting'
import { FallbackRoutingProvider } from './FallbackRoutingProvider'
import { HaversineRoutingProvider } from './HaversineRoutingProvider'
import { HereRoutingProvider } from './HereRoutingProvider'
import { OsrmRoutingProvider } from './OsrmRoutingProvider'

// Basis-Konfig; die einzelnen Tests überschreiben nur das Relevante.
const basis: RoutingKonfig = { provider: 'haversine', osrmProfile: 'driving' }

afterEach(() => vi.restoreAllMocks())

describe('waehleRoutingKern', () => {
  it('nutzt bei gesetztem HERE_API_KEY HERE als Primär mit Haversine als Ersatz', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const kern = waehleRoutingKern({ ...basis, provider: 'here', hereApiKey: 'geheim' })

    expect(kern).toBeInstanceOf(FallbackRoutingProvider)
    const fb = kern as FallbackRoutingProvider
    expect(fb.primaer).toBeInstanceOf(HereRoutingProvider) // verkehrsbewusst
    expect(fb.ersatz).toBeInstanceOf(HaversineRoutingProvider) // Sicherheitsnetz
    expect(warn).not.toHaveBeenCalled()
  })

  it('degradiert HERE ohne API-Key laut auf Haversine (kein stiller Qualitätsverlust)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const kern = waehleRoutingKern({ ...basis, provider: 'here', hereApiKey: undefined })

    expect(kern).toBeInstanceOf(HaversineRoutingProvider)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('HERE_API_KEY fehlt'))
  })

  it('nutzt bei gesetzter OSRM_BASE_URL OSRM als Primär mit Haversine als Ersatz', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const kern = waehleRoutingKern({
      ...basis,
      provider: 'osrm',
      osrmBaseUrl: 'https://osrm.example',
    })

    expect(kern).toBeInstanceOf(FallbackRoutingProvider)
    expect((kern as FallbackRoutingProvider).primaer).toBeInstanceOf(OsrmRoutingProvider)
    expect(warn).not.toHaveBeenCalled()
  })

  it('degradiert OSRM ohne Base-URL laut auf Haversine', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const kern = waehleRoutingKern({ ...basis, provider: 'osrm', osrmBaseUrl: undefined })

    expect(kern).toBeInstanceOf(HaversineRoutingProvider)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('OSRM_BASE_URL fehlt'))
  })

  it('nutzt Haversine ohne Warnung, wenn er explizit gewählt ist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const kern = waehleRoutingKern({ ...basis, provider: 'haversine' })

    expect(kern).toBeInstanceOf(HaversineRoutingProvider)
    expect(warn).not.toHaveBeenCalled()
  })
})
