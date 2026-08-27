// ── Adressen aus Einzelfeldern ───────────────────────────────────────────
// Adressen werden in Säule 1 als EIN String gespeichert, in den Formularen
// aber in vier Feldern erfasst (Straße, Hausnummer, PLZ, Ort). Getrennte
// Felder sind nicht Kosmetik: Ohne PLZ und Ort ist „Hauptstraße 5" bundesweit
// vieldeutig, und die Geokodierung liefert dann still eine falsche Koordinate.
//
// Beide Richtungen liegen hier zusammen, damit Zusammensetzen und Zerlegen
// nicht auseinanderlaufen — und rein, damit sie ohne Browser testbar sind.

export type AdressTeile = {
  strasse: string
  hausnummer: string
  plz: string
  ort: string
}

// Setzt die Teile in deutscher Schreibweise zusammen: „Straße Nr, PLZ Ort".
// Fehlende Teile werden ausgelassen, ohne leere Trennzeichen zu hinterlassen.
export function baueAdresse(t: Partial<AdressTeile>): string {
  const strasseTeil = [t.strasse, t.hausnummer].map((x) => (x ?? '').trim()).filter(Boolean).join(' ')
  const ortTeil = [t.plz, t.ort].map((x) => (x ?? '').trim()).filter(Boolean).join(' ')
  return [strasseTeil, ortTeil].filter(Boolean).join(', ')
}

// Zerlegt einen gespeicherten Adressstring wieder in seine Teile — für das
// Bearbeiten von Bestandsdaten, die noch als Freitext erfasst wurden.
//
// Bewusst tolerant: Was sich nicht sicher zuordnen lässt, bleibt lieber im
// Straßen- bzw. Ortsfeld stehen, statt geraten zu werden. Der Nutzer sieht
// die Felder und kann korrigieren — stille Fehlinterpretation wäre schlimmer
// als ein unvollständig vorbelegtes Formular.
export function zerlegeAdresse(eingabe: string | null | undefined): AdressTeile {
  const leer: AdressTeile = { strasse: '', hausnummer: '', plz: '', ort: '' }
  const s = (eingabe ?? '').trim()
  if (!s) return leer

  // Am LETZTEN Komma trennen — der Ortsteil steht konventionell hinten.
  const i = s.lastIndexOf(',')
  const links = (i >= 0 ? s.slice(0, i) : s).trim()
  const rechts = (i >= 0 ? s.slice(i + 1) : '').trim()

  // Hausnummer = abschließende Ziffernfolge, optional mit Buchstabe oder
  // Bereich („12a", „12-14", „12/1"). Alles davor ist der Straßenname.
  const m = links.match(/^(.*?)\s+(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)$/)
  const strasse = (m ? m[1] : links).trim()
  const hausnummer = m ? m[2].replace(/\s+/g, '') : ''

  // PLZ = führende fünf Ziffern des Ortsteils.
  const p = rechts.match(/^(\d{5})\s+(.*)$/)
  const plz = p ? p[1] : /^\d{5}$/.test(rechts) ? rechts : ''
  const ort = p ? p[2].trim() : plz ? '' : rechts

  return { strasse, hausnummer, plz, ort }
}

// Ist die Adresse vollständig genug für eine eindeutige Geokodierung?
// Eine unvollständige PLZ liefert Treffer im falschen Ort, deshalb genau fünf
// Ziffern.
export function adresseVollstaendig(t: Partial<AdressTeile>): boolean {
  return (
    (t.strasse ?? '').trim().length >= 2 &&
    (t.hausnummer ?? '').trim().length >= 1 &&
    /^\d{5}$/.test((t.plz ?? '').trim()) &&
    (t.ort ?? '').trim().length >= 2
  )
}
