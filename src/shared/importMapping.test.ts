import { describe, it, expect } from 'vitest'
import { rateMapping, norm } from './importMapping'

describe('rateMapping (MediFox-Dan-typische Spalten)', () => {
  it('ordnet deutsche Pflegesoftware-Spalten korrekt zu', () => {
    const headers = [
      'Klienten-Nr.',
      'Nachname',
      'Vorname',
      'Straße',
      'PLZ',
      'Ort',
      'Telefon privat',
      'E-Mail',
      'Pflegegrad',
    ]
    const m = rateMapping(headers)
    expect(m.external_id).toBe('Klienten-Nr.')
    expect(m.nachname).toBe('Nachname')
    expect(m.vorname).toBe('Vorname')
    expect(m.adresse).toBe('Straße')
    expect(m.ort).toBe('Ort') // „Ort" wird „PLZ" vorgezogen
    expect(m.telefon).toBe('Telefon privat')
    expect(m.email).toBe('E-Mail')
    expect(m.pflegegrad).toBe('Pflegegrad')
  })

  it('erkennt auch „Kunden-Nr." als eindeutige Kennung', () => {
    const m = rateMapping(['Kunden-Nr.', 'Vorname'])
    expect(m.external_id).toBe('Kunden-Nr.')
  })

  it('vermeidet Fehlzuordnung kurzer Synonyme', () => {
    // „Stadtteil" darf nicht zu telefon werden, „Relation" nicht zu lat.
    const m = rateMapping(['Stadtteil', 'Relation', 'Vorname'])
    expect(m.telefon).toBeUndefined()
    expect(m.lat).toBeUndefined()
    expect(m.vorname).toBe('Vorname')
  })

  it('löst Umlaute/ß auf', () => {
    expect(norm('Straße')).toBe('strasse')
    expect(norm('Längengrad')).toBe('laengengrad')
    expect(norm('Kunden-Nr.')).toBe('kundennr')
  })
})
