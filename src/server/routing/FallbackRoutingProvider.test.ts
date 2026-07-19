import { describe, it, expect, vi, afterEach } from 'vitest'
import { FallbackRoutingProvider } from './FallbackRoutingProvider'
import type { RoutingProvider } from './RoutingProvider'
import type { Geo } from '@/shared/domain'

const punkte: Geo[] = [
  { lat: 48.0, lng: 7.85 },
  { lat: 48.01, lng: 7.86 },
]

afterEach(() => vi.restoreAllMocks())

describe('FallbackRoutingProvider', () => {
  it('nutzt den primären Provider, wenn er liefert (Ersatz bleibt ungenutzt)', async () => {
    const primaerMatrix = [
      [0, 12],
      [12, 0],
    ]
    const primaer: RoutingProvider = { travelMatrix: vi.fn().mockResolvedValue(primaerMatrix) }
    const ersatz: RoutingProvider = { travelMatrix: vi.fn().mockResolvedValue([[0, 99], [99, 0]]) }

    const fb = new FallbackRoutingProvider(primaer, ersatz)
    const m = await fb.travelMatrix(punkte)

    expect(m).toBe(primaerMatrix)
    expect(primaer.travelMatrix).toHaveBeenCalledWith(punkte)
    expect(ersatz.travelMatrix).not.toHaveBeenCalled()
  })

  it('fällt bei Fehler des primären Providers still auf den Ersatz zurück (kein Throw nach außen)', async () => {
    // Simuliert z. B. einen HERE-HTTP-Fehler (429).
    const primaer: RoutingProvider = {
      travelMatrix: vi.fn().mockRejectedValue(new Error('HERE-Antwort 429 Too Many Requests')),
    }
    const ersatzMatrix = [
      [0, 7],
      [7, 0],
    ]
    const ersatz: RoutingProvider = { travelMatrix: vi.fn().mockResolvedValue(ersatzMatrix) }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const fb = new FallbackRoutingProvider(primaer, ersatz)
    const m = await fb.travelMatrix(punkte)

    expect(m).toBe(ersatzMatrix) // Ergebnis kommt aus dem Ersatz, Request scheitert nicht
    expect(ersatz.travelMatrix).toHaveBeenCalledWith(punkte)
    expect(warn).toHaveBeenCalled() // Degradierung wird protokolliert
  })

  it('fällt auch bei Timeout (AbortError) auf den Ersatz zurück', async () => {
    // Der HERE-Provider bricht bei Zeitüberschreitung via AbortController ab.
    const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    const primaer: RoutingProvider = { travelMatrix: vi.fn().mockRejectedValue(abort) }
    const ersatz: RoutingProvider = { travelMatrix: vi.fn().mockResolvedValue([[0, 5], [5, 0]]) }
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const fb = new FallbackRoutingProvider(primaer, ersatz)
    const m = await fb.travelMatrix(punkte)

    expect(m).toEqual([[0, 5], [5, 0]])
    expect(ersatz.travelMatrix).toHaveBeenCalledWith(punkte)
  })
})
