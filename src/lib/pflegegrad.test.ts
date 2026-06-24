import { describe, it, expect } from 'vitest'
import { berechnePflegegrad, PFLEGEGRAD_MODULE } from './pflegegrad'

describe('berechnePflegegrad (NBA)', () => {
  it('keine Beeinträchtigung → 0 Punkte, kein Pflegegrad', () => {
    const r = berechnePflegegrad({})
    expect(r.punkte).toBe(0)
    expect(r.grad).toBe(0)
  })

  it('alle Module schwerste Stufe → 100 Punkte, Pflegegrad 5', () => {
    const auswahl = Object.fromEntries(PFLEGEGRAD_MODULE.map((m) => [m.id, 4 as const]))
    const r = berechnePflegegrad(auswahl)
    expect(r.punkte).toBe(100)
    expect(r.grad).toBe(5)
  })

  it('Modulgewichte summieren sich auf 100', () => {
    const summe = PFLEGEGRAD_MODULE.reduce((s, m) => s + m.punkteJeStufe[4], 0)
    expect(summe).toBe(100)
  })

  it('genau 12,5 Punkte → Pflegegrad 1 (untere Schwelle)', () => {
    // therapie Stufe 2 (10) + mobilitaet Stufe 1 (2,5) = 12,5
    const r = berechnePflegegrad({ therapie: 2, mobilitaet: 1 })
    expect(r.punkte).toBe(12.5)
    expect(r.grad).toBe(1)
  })

  it('genau 47,5 Punkte → Pflegegrad 3 (Schwelle)', () => {
    // selbstversorgung Stufe 4 (40) + mobilitaet Stufe 3 (7,5) = 47,5
    const r = berechnePflegegrad({ selbstversorgung: 4, mobilitaet: 3 })
    expect(r.punkte).toBe(47.5)
    expect(r.grad).toBe(3)
  })

  it('genau 90 Punkte → Pflegegrad 5 (Schwelle)', () => {
    const r = berechnePflegegrad({ selbstversorgung: 4, therapie: 4, kognition: 4, alltag: 4 })
    expect(r.punkte).toBe(90)
    expect(r.grad).toBe(5)
  })

  it('knapp darunter (86,25) → Pflegegrad 4', () => {
    const r = berechnePflegegrad({ selbstversorgung: 4, therapie: 4, kognition: 4, alltag: 3 })
    expect(r.punkte).toBe(86.25)
    expect(r.grad).toBe(4)
  })

  it('nur Selbstversorgung erheblich (20) → Pflegegrad 1', () => {
    const r = berechnePflegegrad({ selbstversorgung: 2 })
    expect(r.punkte).toBe(20)
    expect(r.grad).toBe(1)
  })
})
