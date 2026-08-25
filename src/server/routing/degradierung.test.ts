import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sollMelden, resetMeldungen, meldeDegradierung, MELDE_FENSTER_MS } from './degradierung'

beforeEach(() => resetMeldungen())
afterEach(() => vi.restoreAllMocks())

describe('sollMelden', () => {
  it('meldet den ersten Vorfall und entprellt Wiederholungen im Fenster', () => {
    const t0 = 1_000_000
    expect(sollMelden('nichtErreichbar', t0)).toBe(true)
    // Ein anhaltender Ausfall erzeugt sonst pro Anfrage ein Monitoring-Event.
    expect(sollMelden('nichtErreichbar', t0 + 1000)).toBe(false)
    expect(sollMelden('nichtErreichbar', t0 + MELDE_FENSTER_MS - 1)).toBe(false)
  })

  it('meldet nach Ablauf des Fensters erneut', () => {
    const t0 = 1_000_000
    sollMelden('nichtErreichbar', t0)
    expect(sollMelden('nichtErreichbar', t0 + MELDE_FENSTER_MS)).toBe(true)
  })

  it('entprellt je Grund getrennt — ein neuer Grund geht sofort durch', () => {
    const t0 = 1_000_000
    expect(sollMelden('nichtErreichbar', t0)).toBe(true)
    expect(sollMelden('fehlkonfiguriert', t0)).toBe(true)
  })
})

describe('meldeDegradierung', () => {
  it('protokolliert jeden Rückfall — auch die entprellten', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    meldeDegradierung('nichtErreichbar', 'ECONNREFUSED')
    meldeDegradierung('nichtErreichbar', 'ECONNREFUSED')

    // Sentry wird entprellt, das Server-Log nicht: im Log muss jeder Vorfall
    // stehen, sonst fehlt bei der Fehlersuche die Häufigkeit.
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Luftlinie'))
  })
})
