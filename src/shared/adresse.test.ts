import { describe, it, expect } from 'vitest'
import { baueAdresse, zerlegeAdresse, adresseVollstaendig } from './adresse'

describe('baueAdresse', () => {
  it('setzt die vollständige Adresse in deutscher Schreibweise zusammen', () => {
    expect(
      baueAdresse({ strasse: 'Habsburgerstr.', hausnummer: '1', plz: '79104', ort: 'Freiburg' }),
    ).toBe('Habsburgerstr. 1, 79104 Freiburg')
  })

  it('lässt fehlende Teile aus, ohne leere Trennzeichen zu hinterlassen', () => {
    // Bestandsdaten haben oft keine PLZ — das darf kein ", Freiburg" mit
    // doppeltem Leerzeichen oder ein hängendes Komma erzeugen.
    expect(baueAdresse({ strasse: 'Habsburgerstr.', hausnummer: '1', ort: 'Freiburg' })).toBe(
      'Habsburgerstr. 1, Freiburg',
    )
    expect(baueAdresse({ strasse: 'Habsburgerstr.', hausnummer: '1' })).toBe('Habsburgerstr. 1')
    expect(baueAdresse({})).toBe('')
  })

  it('ignoriert überflüssige Leerzeichen in den Eingaben', () => {
    expect(
      baueAdresse({ strasse: '  Hauptstraße ', hausnummer: ' 5 ', plz: ' 70563 ', ort: ' Stuttgart ' }),
    ).toBe('Hauptstraße 5, 70563 Stuttgart')
  })
})

describe('zerlegeAdresse', () => {
  it('zerlegt eine vollständige Adresse', () => {
    expect(zerlegeAdresse('Habsburgerstr. 1, 79104 Freiburg')).toEqual({
      strasse: 'Habsburgerstr.',
      hausnummer: '1',
      plz: '79104',
      ort: 'Freiburg',
    })
  })

  it('kommt mit Bestandsdaten ohne PLZ zurecht', () => {
    // So sehen die Adressen aus, die vor der Formularumstellung entstanden sind.
    expect(zerlegeAdresse('Habsburgerstr. 1, Freiburg')).toEqual({
      strasse: 'Habsburgerstr.',
      hausnummer: '1',
      plz: '',
      ort: 'Freiburg',
    })
  })

  it('erkennt Hausnummern mit Zusatz und Bereiche', () => {
    expect(zerlegeAdresse('Kaiser-Joseph-Str. 12a, 79098 Freiburg').hausnummer).toBe('12a')
    expect(zerlegeAdresse('Musterweg 12-14, 10115 Berlin').hausnummer).toBe('12-14')
    expect(zerlegeAdresse('Musterweg 12/1, 10115 Berlin').hausnummer).toBe('12/1')
  })

  it('behält mehrteilige Ortsnamen zusammen', () => {
    expect(zerlegeAdresse('Kaiser-Joseph-Str. 200, 79098 Freiburg im Breisgau').ort).toBe(
      'Freiburg im Breisgau',
    )
  })

  it('lässt Unzuordenbares lieber stehen, als es zu raten', () => {
    // Ohne Hausnummer bleibt alles im Straßenfeld — der Nutzer korrigiert.
    expect(zerlegeAdresse('Irgendwo')).toEqual({
      strasse: 'Irgendwo',
      hausnummer: '',
      plz: '',
      ort: '',
    })
    expect(zerlegeAdresse('')).toEqual({ strasse: '', hausnummer: '', plz: '', ort: '' })
    expect(zerlegeAdresse(null)).toEqual({ strasse: '', hausnummer: '', plz: '', ort: '' })
  })

  it('ist umkehrbar: zerlegen und wieder zusammensetzen ergibt das Original', () => {
    for (const a of [
      'Habsburgerstr. 1, 79104 Freiburg',
      'Habsburgerstr. 1, Freiburg',
      'Kaiser-Joseph-Str. 200, 79098 Freiburg im Breisgau',
    ]) {
      expect(baueAdresse(zerlegeAdresse(a))).toBe(a)
    }
  })
})

describe('adresseVollstaendig', () => {
  it('verlangt alle vier Teile mit fünfstelliger PLZ', () => {
    const voll = { strasse: 'Hauptstraße', hausnummer: '5', plz: '70563', ort: 'Stuttgart' }
    expect(adresseVollstaendig(voll)).toBe(true)
    // Eine vierstellige PLZ träfe den falschen Ort — nicht durchlassen.
    expect(adresseVollstaendig({ ...voll, plz: '7056' })).toBe(false)
    expect(adresseVollstaendig({ ...voll, ort: '' })).toBe(false)
    expect(adresseVollstaendig({ ...voll, hausnummer: '' })).toBe(false)
    expect(adresseVollstaendig({})).toBe(false)
  })
})
