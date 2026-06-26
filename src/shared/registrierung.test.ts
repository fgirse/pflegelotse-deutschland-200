import { describe, it, expect } from 'vitest'
import { registrierungSchema } from './registrierung'

describe('registrierungSchema', () => {
  it('akzeptiert Suchende mit gültigem Typ + Einwilligung', () => {
    const r = registrierungSchema.safeParse({
      typ: 'suchende',
      email: 'a@b.de',
      password: 'geheim12',
      suchendeTyp: 'angehoerige',
      einwilligung: true,
    })
    expect(r.success).toBe(true)
  })

  it('akzeptiert Pflegedienst mit Namen + Einwilligung', () => {
    const r = registrierungSchema.safeParse({
      typ: 'dienst',
      email: 'dienst@b.de',
      password: 'geheim12',
      dienstName: 'Sozialstation Freiburg',
      einwilligung: true,
    })
    expect(r.success).toBe(true)
  })

  it('lehnt fehlende/abgelehnte Einwilligung ab', () => {
    const ohne = registrierungSchema.safeParse({
      typ: 'suchende',
      email: 'a@b.de',
      password: 'geheim12',
      suchendeTyp: 'angehoerige',
    })
    expect(ohne.success).toBe(false)
    const falsch = registrierungSchema.safeParse({
      typ: 'suchende',
      email: 'a@b.de',
      password: 'geheim12',
      suchendeTyp: 'angehoerige',
      einwilligung: false,
    })
    expect(falsch.success).toBe(false)
  })

  it('lehnt Pflegedienst ohne Namen ab', () => {
    const r = registrierungSchema.safeParse({
      typ: 'dienst',
      email: 'dienst@b.de',
      password: 'geheim12',
      einwilligung: true,
    })
    expect(r.success).toBe(false)
  })

  it('lehnt zu kurzes Passwort ab', () => {
    const r = registrierungSchema.safeParse({
      typ: 'suchende',
      email: 'a@b.de',
      password: 'kurz',
      suchendeTyp: 'patient',
      einwilligung: true,
    })
    expect(r.success).toBe(false)
  })

  it('akzeptiert keine Rolle/tenantId aus dem Client (werden ignoriert)', () => {
    const r = registrierungSchema.safeParse({
      typ: 'suchende',
      email: 'a@b.de',
      password: 'geheim12',
      suchendeTyp: 'sozialdienst',
      einwilligung: true,
      role: 'plattform_admin',
      tenantId: 'fremd',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect('role' in r.data).toBe(false)
      expect('tenantId' in r.data).toBe(false)
    }
  })
})
