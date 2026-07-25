import { createHmac } from 'node:crypto'

// ── Hash-verkettetes Leistungsnachweis-Journal (Pflichtenheft 5.4) ─────────
// Jeder Nachweis-Eintrag referenziert den Hash des vorherigen (prevHash). Der
// Hash ist ein HMAC über den kanonisch serialisierten Kern + prevHash. So sind
// nicht nur Änderungen an einzelnen Einträgen erkennbar, sondern auch gelöschte
// oder umgeordnete — die Kette bricht. Der Pepper (AUDIT_PEPPER) bleibt geheim;
// ohne ihn ist der Hash wertlos. Reine Logik, Pepper injizierbar (testbar).

// Genesis: Startwert der Kette je Mandant (kein Vorgänger).
export const GENESIS_HASH = '0'.repeat(64)

// Der signierte Kern eines Nachweises (ohne prevHash/hash).
export interface NachweisKern {
  pseudonymId: string
  datum: string // ISO YYYY-MM-DD
  tourId: string
  erbrachteLeistungen: string[]
  istAnkunft?: number
  istAbfahrt?: number
  bestaetigtAm: string // ISO-Zeitstempel
  bestaetigtVon: string // Pflegekraft-Kennung
}

export interface NachweisEintrag extends NachweisKern {
  prevHash: string
  hash: string
}

// Stabile, reihenfolge-unabhängige Serialisierung (feste Keys, sortierte Codes).
export function kanonisch(k: NachweisKern): string {
  return JSON.stringify({
    pseudonymId: k.pseudonymId,
    datum: k.datum,
    tourId: k.tourId,
    erbrachteLeistungen: [...k.erbrachteLeistungen].sort(),
    istAnkunft: k.istAnkunft ?? null,
    istAbfahrt: k.istAbfahrt ?? null,
    bestaetigtAm: k.bestaetigtAm,
    bestaetigtVon: k.bestaetigtVon,
  })
}

export function berechneHash(kern: NachweisKern, prevHash: string, pepper: string): string {
  return createHmac('sha256', pepper).update(`${prevHash}|${kanonisch(kern)}`).digest('hex')
}

export interface KettenPruefung {
  gueltig: boolean
  bruchBei: number | null // Index des ersten fehlerhaften Eintrags, sonst null
}

// Verifiziert eine chronologisch geordnete Kette: jeder prevHash muss auf den
// Hash des Vorgängers zeigen, und jeder Hash muss den Inhalt bestätigen.
export function verifiziereKette(eintraege: NachweisEintrag[], pepper: string): KettenPruefung {
  let prev = GENESIS_HASH
  for (let i = 0; i < eintraege.length; i++) {
    const e = eintraege[i]
    if (e.prevHash !== prev) return { gueltig: false, bruchBei: i }
    if (berechneHash(e, e.prevHash, pepper) !== e.hash) return { gueltig: false, bruchBei: i }
    prev = e.hash
  }
  return { gueltig: true, bruchBei: null }
}

// Bildet den nächsten Eintrag aus Kern + aktuellem Ketten-Kopf.
export function naechsterEintrag(kern: NachweisKern, kopfHash: string, pepper: string): NachweisEintrag {
  const prevHash = kopfHash || GENESIS_HASH
  return { ...kern, prevHash, hash: berechneHash(kern, prevHash, pepper) }
}
