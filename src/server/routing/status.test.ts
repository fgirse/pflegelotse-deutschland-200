import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  bewerteRouting,
  istKonfiguriert,
  pruefeRouting,
  resetStatusCache,
  PROBE_PUNKTE,
} from './status'
import { resetMeldungen } from './degradierung'
import type { RoutingKonfig } from './waehleRouting'

const basis: RoutingKonfig = { provider: 'haversine', osrmProfile: 'driving' }
const osrm: RoutingKonfig = { ...basis, provider: 'osrm', osrmBaseUrl: 'https://osrm.example' }

beforeEach(() => {
  resetStatusCache()
  resetMeldungen()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('istKonfiguriert', () => {
  it('erkennt vollständige und unvollständige Straßen-Konfigurationen', () => {
    expect(istKonfiguriert(osrm)).toBe(true)
    expect(istKonfiguriert({ ...basis, provider: 'osrm' })).toBe(false)
    expect(istKonfiguriert({ ...basis, provider: 'here', hereApiKey: 'k' })).toBe(true)
    expect(istKonfiguriert({ ...basis, provider: 'here' })).toBe(false)
    // Haversine ist kein Straßen-Provider — nie „konfiguriert".
    expect(istKonfiguriert(basis)).toBe(false)
  })
})

describe('bewerteRouting', () => {
  it('meldet bei Haversine Luftlinie als bewusste Konfiguration', () => {
    expect(bewerteRouting(basis, 'entfaellt')).toEqual({
      modus: 'luftlinie',
      provider: 'haversine',
      grund: 'nichtKonfiguriert',
    })
  })

  it('meldet fehlende Zugangsdaten als Fehlkonfiguration', () => {
    expect(bewerteRouting({ ...basis, provider: 'osrm' }, 'entfaellt')).toEqual({
      modus: 'luftlinie',
      provider: 'osrm',
      grund: 'fehlkonfiguriert',
    })
  })

  it('meldet einen nicht antwortenden Server als Störfall, nicht als „läuft"', () => {
    expect(bewerteRouting(osrm, 'fehler')).toEqual({
      modus: 'luftlinie',
      provider: 'osrm',
      grund: 'nichtErreichbar',
    })
  })

  it('meldet Straßenmodus nur bei erfolgreicher Probe', () => {
    expect(bewerteRouting(osrm, 'ok')).toEqual({ modus: 'strasse', provider: 'osrm' })
  })
})

describe('pruefeRouting', () => {
  it('prüft den Server aktiv und meldet ihn bei gültiger Matrix als erreichbar', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'Ok', durations: [[0, 8], [8, 0]] })),
    )

    await expect(pruefeRouting(osrm)).resolves.toEqual({ modus: 'strasse', provider: 'osrm' })
    // Die Probe darf nur die beiden festen Testpunkte senden — nie Klientendaten.
    const url = String(fetchSpy.mock.calls[0]?.[0])
    expect(url).toContain(`${PROBE_PUNKTE[0].lng},${PROBE_PUNKTE[0].lat}`)
  })

  it('erkennt einen ausgefallenen Server, statt den Fallback als „ok" zu lesen', async () => {
    // Genau der gefährliche Fall: der FallbackRoutingProvider würde hier still
    // Haversine liefern. Die Probe muss den Primär direkt fragen.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(pruefeRouting(osrm)).resolves.toEqual({
      modus: 'luftlinie',
      provider: 'osrm',
      grund: 'nichtErreichbar',
    })
  })

  it('wertet eine unbrauchbare Matrix (nicht erreichbare Punkte) als Störung', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'Ok', durations: [[0, null], [null, 0]] })),
    )

    await expect(pruefeRouting(osrm)).resolves.toMatchObject({ grund: 'nichtErreichbar' })
  })

  it('cacht das Ergebnis, statt bei jedem Aufruf den Server zu fragen', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'Ok', durations: [[0, 8], [8, 0]] })),
    )

    await pruefeRouting(osrm)
    await pruefeRouting(osrm)
    await pruefeRouting(osrm)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('fragt ohne Straßen-Provider gar nicht erst an', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(pruefeRouting(basis)).resolves.toMatchObject({ grund: 'nichtKonfiguriert' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
