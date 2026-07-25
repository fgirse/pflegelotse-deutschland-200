import { describe, it, expect } from 'vitest'
import { naechsterEintrag, verifiziereKette, GENESIS_HASH, type NachweisKern, type NachweisEintrag } from './kette'

const PEPPER = 'test-pepper'

function kern(over: Partial<NachweisKern> = {}): NachweisKern {
  return {
    pseudonymId: '00000000-0000-4000-8000-000000000001',
    datum: '2026-07-25',
    tourId: 'T1',
    erbrachteLeistungen: ['LK01'],
    istAnkunft: 490,
    istAbfahrt: 520,
    bestaetigtAm: '2026-07-25T08:20:00.000Z',
    bestaetigtVon: 'pk-001',
    ...over,
  }
}

// Baut eine gültige Kette aus mehreren Kernen.
function baueKette(kerne: NachweisKern[]): NachweisEintrag[] {
  const eintraege: NachweisEintrag[] = []
  let kopf = GENESIS_HASH
  for (const k of kerne) {
    const e = naechsterEintrag(k, kopf, PEPPER)
    eintraege.push(e)
    kopf = e.hash
  }
  return eintraege
}

describe('Leistungsnachweis-Kette', () => {
  it('verifiziert eine gültige Kette', () => {
    const kette = baueKette([kern(), kern({ tourId: 'T2', erbrachteLeistungen: ['LK15'] }), kern({ datum: '2026-07-26' })])
    expect(verifiziereKette(kette, PEPPER)).toEqual({ gueltig: true, bruchBei: null })
  })

  it('der erste Eintrag zeigt auf den Genesis-Hash', () => {
    const kette = baueKette([kern()])
    expect(kette[0].prevHash).toBe(GENESIS_HASH)
  })

  it('erkennt einen manipulierten Eintrag (Inhalt geändert)', () => {
    const kette = baueKette([kern(), kern({ tourId: 'T2' })])
    // Nachträglich die erbrachten Leistungen des ersten Eintrags fälschen.
    kette[0] = { ...kette[0], erbrachteLeistungen: ['LK99'] }
    expect(verifiziereKette(kette, PEPPER)).toEqual({ gueltig: false, bruchBei: 0 })
  })

  it('erkennt einen gelöschten Eintrag (Kette bricht)', () => {
    const kette = baueKette([kern(), kern({ tourId: 'T2' }), kern({ tourId: 'T3' })])
    // Mittleren Eintrag entfernen → prevHash des dritten passt nicht mehr.
    const verkuerzt = [kette[0], kette[2]]
    expect(verifiziereKette(verkuerzt, PEPPER).gueltig).toBe(false)
  })

  it('erkennt einen falschen Pepper', () => {
    const kette = baueKette([kern()])
    expect(verifiziereKette(kette, 'falscher-pepper').gueltig).toBe(false)
  })
})
