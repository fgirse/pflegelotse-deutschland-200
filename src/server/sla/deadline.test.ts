import { describe, it, expect } from 'vitest'
import { berechneDeadline, istAbgelaufen, slaKennzahlen } from './deadline'

describe('SLA-Deadline', () => {
  it('setzt 24h-Frist für normale Bedarfe', () => {
    const d = berechneDeadline(0, false)
    expect(d).toBe(new Date(24 * 60 * 60_000).toISOString())
  })

  it('setzt kürzere 4h-Frist für Express-Bedarfe', () => {
    const d = berechneDeadline(0, true)
    expect(d).toBe(new Date(4 * 60 * 60_000).toISOString())
  })
})

describe('istAbgelaufen', () => {
  const deadline = new Date(1000).toISOString()

  it('true, wenn offen und Frist verstrichen', () => {
    expect(istAbgelaufen({ status: 'offen', deadlineAt: deadline }, 2000)).toBe(true)
    expect(istAbgelaufen({ status: 'in_bearbeitung', deadlineAt: deadline }, 2000)).toBe(true)
  })

  it('false, wenn bereits vergeben oder abgesagt', () => {
    expect(istAbgelaufen({ status: 'vergeben', deadlineAt: deadline }, 2000)).toBe(false)
    expect(istAbgelaufen({ status: 'abgesagt', deadlineAt: deadline }, 2000)).toBe(false)
  })

  it('false, wenn Frist noch nicht erreicht', () => {
    expect(istAbgelaufen({ status: 'offen', deadlineAt: deadline }, 500)).toBe(false)
  })

  it('false ohne Frist', () => {
    expect(istAbgelaufen({ status: 'offen', deadlineAt: undefined }, 2000)).toBe(false)
  })
})

describe('slaKennzahlen', () => {
  it('berechnet Rückmeldequote und Reaktionszeit', () => {
    const k = slaKennzahlen([
      { status: 'offen', createdAt: '1970-01-01T00:00:00.000Z', firstResponseAt: undefined },
      {
        status: 'in_bearbeitung',
        createdAt: '1970-01-01T00:00:00.000Z',
        firstResponseAt: '1970-01-01T00:30:00.000Z', // 30 Min
      },
      {
        status: 'vergeben',
        createdAt: '1970-01-01T00:00:00.000Z',
        firstResponseAt: '1970-01-01T01:00:00.000Z', // 60 Min
      },
    ])
    expect(k.gesamt).toBe(3)
    expect(k.offen).toBe(1)
    expect(k.inBearbeitung).toBe(1)
    expect(k.vergeben).toBe(1)
    expect(k.mitAngebot).toBe(2)
    expect(k.rueckmeldequote).toBeCloseTo(0.67, 2)
    expect(k.avgReaktionMin).toBe(45)
  })

  it('avgReaktionMin ist null ohne Reaktionen', () => {
    const k = slaKennzahlen([{ status: 'offen', createdAt: '1970-01-01T00:00:00.000Z' }])
    expect(k.avgReaktionMin).toBeNull()
    expect(k.rueckmeldequote).toBe(0)
  })
})
