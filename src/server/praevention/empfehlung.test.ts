import { describe, it, expect } from 'vitest'
import { generiereEmpfehlungen, baueDokument } from './empfehlung'

describe('generiereEmpfehlungen (/F920/)', () => {
  it('schlägt das §20-Angebot vor, wenn ein Risiko markiert ist', () => {
    const e = generiereEmpfehlungen([{ feldId: 'bewegung', risiken: ['sturz'] }])
    expect(e).toHaveLength(1)
    expect(e[0].paragraf20).toBe('Bewegungsgewohnheiten')
    expect(e[0].titel).toMatch(/Sturzprophylaxe/)
    expect(e[0].begruendung).toMatch(/Sturz in den letzten 12 Monaten/)
  })

  it('erzeugt keine Empfehlung ohne markiertes Risiko', () => {
    expect(generiereEmpfehlungen([{ feldId: 'ernaehrung', risiken: [] }])).toHaveLength(0)
  })

  it('ignoriert unbekannte Handlungsfelder und unbekannte Risiken', () => {
    expect(generiereEmpfehlungen([{ feldId: 'unbekannt', risiken: ['x'] }])).toHaveLength(0)
    expect(generiereEmpfehlungen([{ feldId: 'bewegung', risiken: ['kein-risiko'] }])).toHaveLength(0)
  })

  it('erzeugt mehrere Empfehlungen über Felder hinweg', () => {
    const e = generiereEmpfehlungen([
      { feldId: 'bewegung', risiken: ['gangunsicher'] },
      { feldId: 'ernaehrung', risiken: ['gewichtsverlust', 'trinkmenge'] },
    ])
    expect(e.map((x) => x.paragraf20)).toEqual(['Bewegungsgewohnheiten', 'Ernährung'])
  })
})

describe('baueDokument (/F930/)', () => {
  it('enthält §20-Abschnitt, pseudonyme Kennung und Mensch-entscheidet-Hinweis', () => {
    const doc = baueDokument({
      pseudonymId: '11111111-1111-4111-8111-111111111111',
      status: 'finalisiert',
      felder: [{ feldId: 'bewegung', risiken: ['sturz'], ressourcen: 'geht mit Rollator' }],
      empfehlungen: generiereEmpfehlungen([{ feldId: 'bewegung', risiken: ['sturz'] }]),
      freitext: 'Mit Tochter besprochen.',
      erstelltVon: 'pk@demo',
      datum: '2026-06-25',
    })
    expect(doc).toMatch(/§20 SGB V/)
    expect(doc).toMatch(/11111111-1111-4111-8111-111111111111/)
    expect(doc).toMatch(/Fachliche Entscheidung und Verantwortung liegen bei der Pflegefachkraft/)
    expect(doc).toMatch(/geht mit Rollator/)
  })
})
