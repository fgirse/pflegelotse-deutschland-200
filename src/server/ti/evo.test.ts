import { describe, it, expect } from 'vitest'
import { evoSchema, mappeEvo, type EvoNutzlast } from './evo'

const nutzlast: EvoNutzlast = {
  verordnungId: 'VO-2026-001',
  patient: { vorname: 'Anna', nachname: 'Bauer', adresse: 'Habsburgerstr. 1, Freiburg', versichertennummer: 'A123456789' },
  pflegegrad: 3,
  leistungen: ['LK01', 'LK15'],
  zeitraum: { von: '2026-08-01', bis: '2026-10-31' },
  verordnetVon: 'LANR 123456789',
}

describe('eVO-Schema', () => {
  it('akzeptiert eine gültige Verordnung', () => {
    expect(evoSchema.safeParse(nutzlast).success).toBe(true)
  })
  it('lehnt eine Verordnung ohne Leistungen ab', () => {
    expect(evoSchema.safeParse({ ...nutzlast, leistungen: [] }).success).toBe(false)
  })
})

describe('mappeEvo (Zwei-Säulen-Trennung)', () => {
  const geo = { lat: 48.012, lng: 7.853 }
  const m = mappeEvo(nutzlast, 'demo', geo, 'pseudo-1', '2026-07-26T10:00:00.000Z')

  it('legt Patient-PII ausschließlich in Säule 1', () => {
    expect(m.identitaet).toMatchObject({
      pseudonymId: 'pseudo-1',
      tenantId: 'demo',
      vorname: 'Anna',
      nachname: 'Bauer',
      adresse: 'Habsburgerstr. 1, Freiburg',
      externalId: 'kvnr:A123456789',
    })
    // Säule 2 enthält keinerlei Namens-/Adressfelder.
    expect(JSON.stringify(m.operativ)).not.toContain('Bauer')
    expect(JSON.stringify(m.verordnung)).not.toContain('Habsburger')
  })

  it('überträgt Leistungen, Pflegegrad und Geo in Säule 2', () => {
    expect(m.operativ).toMatchObject({
      pseudonymId: 'pseudo-1',
      geo,
      pflegegrad: 3,
      leistungen: ['LK01', 'LK15'],
      status: 'aktiv',
    })
  })

  it('zeichnet die Verordnung mit Zeitraum und ID auf (kein PII)', () => {
    expect(m.verordnung).toMatchObject({
      verordnungId: 'VO-2026-001',
      leistungen: ['LK01', 'LK15'],
      zeitraumVon: '2026-08-01',
      zeitraumBis: '2026-10-31',
      verordnetVon: 'LANR 123456789',
    })
  })
})
