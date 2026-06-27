// Zielfelder des Klienten-Imports und automatische Spaltenerkennung.
// Geo wird aus adresse/ort geokodiert, falls lat/lng nicht zugeordnet sind.
export interface ZielFeld {
  key: string
  label: string
  req?: boolean
}

export const ZIELFELDER: ZielFeld[] = [
  { key: 'external_id', label: 'Eindeutige Kennung (Pflicht)', req: true },
  { key: 'vorname', label: 'Vorname' },
  { key: 'nachname', label: 'Nachname' },
  { key: 'adresse', label: 'Adresse (Straße)' },
  { key: 'ort', label: 'Ort / PLZ' },
  { key: 'telefon', label: 'Telefon' },
  { key: 'email', label: 'E-Mail' },
  { key: 'pflegegrad', label: 'Pflegegrad' },
  { key: 'leistungen', label: 'Leistungen (Trenner ; oder ,)' },
  { key: 'qualifikation', label: 'Qualifikation' },
  { key: 'zeitfenster_von', label: 'Einsatz von (HH:MM)' },
  { key: 'zeitfenster_bis', label: 'Einsatz bis (HH:MM)' },
  { key: 'dauer', label: 'Dauer (Min)' },
  { key: 'lat', label: 'Breitengrad (optional)' },
  { key: 'lng', label: 'Längengrad (optional)' },
]

// Normalisiert Spaltennamen: Umlaute/ß auflösen (sonst matcht „Straße" nicht),
// klein, ohne Sonderzeichen. „Kunden-Nr." → "kundennr", „Straße" → "strasse".
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')
}

// Synonyme (in normalisierter Form), zugeschnitten u. a. auf MediFox-Dan-Exporte.
const SYNONYME: Record<string, string[]> = {
  external_id: ['externalid', 'kundennr', 'kundennummer', 'kunden', 'klientnr', 'klientennr', 'klientennummer', 'klient', 'pflegekundennr', 'aktenzeichen'],
  vorname: ['vorname', 'firstname'],
  nachname: ['nachname', 'familienname', 'lastname', 'surname'],
  adresse: ['strasse', 'adresse', 'anschrift', 'wohnanschrift'],
  ort: ['ort', 'plz', 'wohnort', 'stadt', 'postleitzahl', 'plzort'],
  telefon: ['telefon', 'telefonprivat', 'telprivat', 'rufnummer', 'festnetz'],
  email: ['email', 'emailadresse', 'mail'],
  pflegegrad: ['pflegegrad', 'pg'],
  leistungen: ['leistungen', 'leistung', 'leistungskomplexe', 'leistungskomplex', 'lk'],
  qualifikation: ['qualifikation', 'qualifikationen', 'qual'],
  zeitfenster_von: ['von', 'beginn', 'start', 'einsatzvon', 'uhrzeitvon', 'zeitvon', 'startzeit'],
  zeitfenster_bis: ['bis', 'ende', 'einsatzbis', 'uhrzeitbis', 'zeitbis', 'endzeit'],
  dauer: ['dauer', 'minuten', 'einsatzdauer', 'duration'],
  lat: ['lat', 'breitengrad', 'breite', 'latitude'],
  lng: ['lng', 'lon', 'laengengrad', 'laenge', 'longitude'],
}

// Schlägt anhand der Spaltenüberschriften eine Zuordnung vor: exakte (norma-
// lisierte) Treffer zuerst, dann Teilstring — letzterer NUR für Synonyme ab 4
// Zeichen (sonst würden „von/bis/lat/pg/lk" zu viele Spalten falsch greifen).
// Eine Spalte wird höchstens einem Feld zugeordnet.
export function rateMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  const belegt = new Set<string>()
  for (const f of ZIELFELDER) {
    const syns = [f.key, ...(SYNONYME[f.key] ?? [])]
    let treffer: string | undefined
    // 1) exakter (normalisierter) Treffer, Synonyme in Prioritätsreihenfolge.
    for (const syn of syns) {
      treffer = headers.find((h) => !belegt.has(h) && norm(h) === syn)
      if (treffer) break
    }
    // 2) Teilstring — nur für Synonyme ab 4 Zeichen (sonst greifen „von/bis/
    //    lat/pg/lk" zu viele Spalten falsch).
    if (!treffer) {
      for (const syn of syns) {
        if (syn.length < 4) continue
        treffer = headers.find((h) => !belegt.has(h) && norm(h).includes(syn))
        if (treffer) break
      }
    }
    if (treffer) {
      map[f.key] = treffer
      belegt.add(treffer)
    }
  }
  return map
}
