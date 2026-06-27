import { describe, it, expect } from 'vitest'
import { parseCsv } from './parse'

describe('parseCsv', () => {
  it('erkennt Semikolon-Trennung (deutsches Excel) und Kopfzeile', () => {
    const { headers, rows } = parseCsv('Vorname;Nachname;Ort\nAnna;Bauer;Freiburg\n')
    expect(headers).toEqual(['Vorname', 'Nachname', 'Ort'])
    expect(rows).toEqual([{ Vorname: 'Anna', Nachname: 'Bauer', Ort: 'Freiburg' }])
  })

  it('versteht Komma-Trennung', () => {
    const { headers, rows } = parseCsv('a,b\n1,2\n')
    expect(headers).toEqual(['a', 'b'])
    expect(rows[0]).toEqual({ a: '1', b: '2' })
  })

  it('respektiert Anführungszeichen mit eingebettetem Trennzeichen', () => {
    const { rows } = parseCsv('name;adresse\nMüller;"Hauptstr. 1; Hinterhaus"\n')
    expect(rows[0].adresse).toBe('Hauptstr. 1; Hinterhaus')
  })

  it('entfernt BOM und überspringt Leerzeilen', () => {
    const { headers, rows } = parseCsv('﻿a;b\n\n1;2\n\n')
    expect(headers).toEqual(['a', 'b'])
    expect(rows).toHaveLength(1)
  })

  it('behandelt doppelte Anführungszeichen als Escape', () => {
    const { rows } = parseCsv('x\n"sagt ""hallo"""\n')
    expect(rows[0].x).toBe('sagt "hallo"')
  })
})
