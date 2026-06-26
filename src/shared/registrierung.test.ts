import { describe, it, expect } from 'vitest'
import { registrierungSchema } from './registrierung'

describe('registrierungSchema', () => {
  it('akzeptiert Suchende mit gültigem Typ', () => {
    const r = registrierungSchema.safeParse({
      typ: 'suchende',
      email: 'a@b.de',
      password: 'geheim12',
      suchendeTyp: 'angehoerige',
    })
    expect(r.success).toBe(true)
  })

  it('akzeptiert Pflegedienst mit Namen', () => {
    const r = registrierungSchema.safeParse({
      typ: 'dienst',
      email: 'dienst@b.de',
      password: 'geheim12',
      dienstName: 'Sozialstation Freiburg',
    })
    expect(r.success).toBe(true)
  })

  it('lehnt Pflegedienst ohne Namen ab', () => {
    const r = registrierungSchema.safeParse({
      typ: 'dienst',
      email: 'dienst@b.de',
      password: 'geheim12',
    })
    expect(r.success).toBe(false)
  })

  it('lehnt zu kurzes Passwort ab', () => {
    const r = registrierungSchema.safeParse({
      typ: 'suchende',
      email: 'a@b.de',
      password: 'kurz',
      suchendeTyp: 'patient',
    })
    expect(r.success).toBe(false)
  })

  it('akzeptiert keine Rolle/tenantId aus dem Client (werden ignoriert)', () => {
    const r = registrierungSchema.safeParse({
      typ: 'suchende',
      email: 'a@b.de',
      password: 'geheim12',
      suchendeTyp: 'sozialdienst',
      role: 'plattform_admin',
      tenantId: 'fremd',
    })
    // discriminatedUnion strippt unbekannte Felder — role/tenantId landen nicht im Ergebnis.
    expect(r.success).toBe(true)
    if (r.success) {
      expect('role' in r.data).toBe(false)
      expect('tenantId' in r.data).toBe(false)
    }
  })
})
