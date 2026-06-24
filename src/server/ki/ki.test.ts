import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPT } from './systemPrompt'
import { sucheLeistungen } from './leistungskatalog'
import { kiNachrichtSchema } from '@/shared/ki'

describe('KI-Guardrails (System-Prompt /F630/)', () => {
  it('verweist auf die §7a-Beratung', () => {
    expect(SYSTEM_PROMPT).toContain('§7a')
  })
  it('verbietet medizinische/pflegefachliche Bewertung und Pflegegrad-Feststellung', () => {
    expect(SYSTEM_PROMPT).toMatch(/KEINE medizinische/)
    expect(SYSTEM_PROMPT).toMatch(/KEINEN Pflegegrad fest/)
  })
  it('schreibt Datenminimierung vor (keine Kontaktdaten erfragen, /F640/)', () => {
    expect(SYSTEM_PROMPT).toMatch(/DATENMINIMIERUNG/)
    expect(SYSTEM_PROMPT).toMatch(/Adresse/)
  })
})

describe('Leistungskatalog-Lookup (/F620/)', () => {
  it('findet Grundpflege per Stichwort', () => {
    expect(sucheLeistungen('duschen').map((l) => l.code)).toContain('LK02')
  })
  it('findet Behandlungspflege (Medikamente)', () => {
    const t = sucheLeistungen('medikament')
    expect(t.map((l) => l.code)).toContain('LK15')
    expect(t[0].qualifikation).toBe('behandlungspflege')
  })
  it('findet per Code', () => {
    expect(sucheLeistungen('LK01').map((l) => l.code)).toContain('LK01')
  })
  it('liefert nichts bei leerem Stichwort', () => {
    expect(sucheLeistungen('')).toHaveLength(0)
  })
})

describe('Datenminimierung (/F640/)', () => {
  it('lässt nur role und content durch — PII-Felder werden verworfen', () => {
    const parsed = kiNachrichtSchema.parse({
      role: 'user',
      content: 'Hallo',
      email: 'max@example.de',
      telefon: '0761-123',
      nachname: 'Mustermann',
    } as Record<string, unknown>)
    expect(parsed).toEqual({ role: 'user', content: 'Hallo' })
    expect('email' in parsed).toBe(false)
    expect('telefon' in parsed).toBe(false)
  })
})
