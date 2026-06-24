import { describe, it, expect } from 'vitest'
import { centsZuMollie, centsZuEuro, EXPRESS_CENTS, LEAD_FEE_CENTS, ABO_TIERS } from './pricing'

describe('Pricing', () => {
  it('formatiert Cent als Mollie-Betragsstring', () => {
    expect(centsZuMollie(1990)).toBe('19.90')
    expect(centsZuMollie(4900)).toBe('49.00')
    expect(centsZuMollie(5)).toBe('0.05')
  })

  it('formatiert Cent als deutsche Euro-Anzeige', () => {
    expect(centsZuEuro(1990)).toBe('19,90 €')
    expect(centsZuEuro(100)).toBe('1,00 €')
  })

  it('hat die erwarteten Tarif-Konstanten', () => {
    expect(EXPRESS_CENTS).toBe(1990)
    expect(LEAD_FEE_CENTS).toBe(4900)
  })

  it('definiert drei aufsteigende Abo-Stufen', () => {
    const preise = [
      ABO_TIERS.klein.monatlichCents,
      ABO_TIERS.mittel.monatlichCents,
      ABO_TIERS.gross.monatlichCents,
    ]
    expect(preise).toEqual([...preise].sort((a, b) => a - b))
    expect(preise[0]).toBeGreaterThan(0)
  })
})
