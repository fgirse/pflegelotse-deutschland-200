import { describe, it, expect } from 'vitest'
import { mappeFhirBundle } from './fhir'

// Realistisches (vereinfachtes) HKP-FHIR-Bundle: Patient + ServiceRequest +
// Practitioner. KVNR über das Standard-System, LANR über KBV_NS_Base_ANR.
const bundle = {
  resourceType: 'Bundle',
  identifier: { system: 'urn:ietf:rfc:3986', value: 'VO-FHIR-4711' },
  type: 'document',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        name: [{ family: 'Bauer', given: ['Anna', 'Maria'] }],
        birthDate: '1950-03-01',
        address: [{ line: ['Habsburgerstr. 1'], postalCode: '79104', city: 'Freiburg' }],
        identifier: [{ system: 'http://fhir.de/sid/gkv/kvid-10', value: 'A123456789' }],
      },
    },
    {
      resource: {
        resourceType: 'ServiceRequest',
        status: 'active',
        code: { coding: [{ system: 'https://example/hkp', code: '01' }, { system: 'https://example/hkp', code: '15' }] },
        occurrencePeriod: { start: '2026-08-01T00:00:00+02:00', end: '2026-10-31' },
      },
    },
    {
      resource: {
        resourceType: 'Practitioner',
        name: [{ family: 'Arzt' }],
        identifier: [{ system: 'https://fhir.kbv.de/NamingSystem/KBV_NS_Base_ANR', value: '123456789' }],
      },
    },
  ],
}

describe('mappeFhirBundle', () => {
  it('mappt ein gültiges Bundle auf EvoNutzlast', () => {
    const r = mappeFhirBundle(bundle)
    expect('ok' in r).toBe(true)
    if (!('ok' in r)) return
    expect(r.ok).toMatchObject({
      verordnungId: 'VO-FHIR-4711',
      patient: {
        vorname: 'Anna Maria',
        nachname: 'Bauer',
        adresse: 'Habsburgerstr. 1, 79104 Freiburg',
        versichertennummer: 'A123456789',
      },
      // HKP-Codes 01/15 → interne LK01/LK15 (Crosswalk).
      leistungen: ['LK01', 'LK15'],
      zeitraum: { von: '2026-08-01', bis: '2026-10-31' },
      verordnetVon: '123456789',
    })
  })

  it('meldet ein fehlendes Bundle sauber', () => {
    expect(mappeFhirBundle({ resourceType: 'Patient' })).toEqual({ fehler: 'Kein FHIR-Bundle' })
  })

  it('meldet einen fehlenden ServiceRequest', () => {
    const ohneSr = { ...bundle, entry: bundle.entry.filter((e) => e.resource.resourceType !== 'ServiceRequest') }
    expect(mappeFhirBundle(ohneSr)).toEqual({ fehler: 'ServiceRequest (Leistung) fehlt im Bundle' })
  })

  it('meldet einen fehlenden Zeitraum', () => {
    const ohnePeriod = {
      ...bundle,
      entry: bundle.entry.map((e) =>
        e.resource.resourceType === 'ServiceRequest'
          ? { resource: { ...e.resource, occurrencePeriod: undefined } }
          : e,
      ),
    }
    expect(mappeFhirBundle(ohnePeriod)).toEqual({ fehler: 'Verordnungszeitraum (occurrencePeriod) fehlt' })
  })
})
