// Kostenträger (Krankenversicherer) für Bedarfe. Für bietende Pflegedienste
// wirtschaftlich wichtig: gesetzlich (GKV) und privat (PKV) werden unterschiedlich
// abgerechnet — PKV bringt i. d. R. höhere Sätze/Marge. Quelle der Kassenlisten:
// src/shared/data/krankenkassen-{gesetzlich,privat}.json.
import gesetzlichRoh from './data/krankenkassen-gesetzlich.json'
import privatRoh from './data/krankenkassen-privat.json'

// Art des Kostenträgers — die für den Dienst entscheidende Unterscheidung.
export const KOSTENTRAEGER_ARTEN = ['gesetzlich', 'privat'] as const
export type KostentraegerArt = (typeof KOSTENTRAEGER_ARTEN)[number]

// Die JSON-Dateien haben je Art unterschiedliche Zusatzfelder; gemeinsam ist
// nur „name". Mehr brauchen wir für Auswahl/Anzeige nicht.
interface KasseRoh {
  name: string
}

// Alphabetisch sortierte Kassennamen je Art (für Dropdowns).
export const KASSEN_GESETZLICH: string[] = (gesetzlichRoh as KasseRoh[])
  .map((k) => k.name)
  .sort((a, b) => a.localeCompare(b, 'de'))

export const KASSEN_PRIVAT: string[] = (privatRoh as KasseRoh[])
  .map((k) => k.name)
  .sort((a, b) => a.localeCompare(b, 'de'))

// Liefert die Kassenliste zur gewählten Art.
export function kassenFuerArt(art: KostentraegerArt): string[] {
  return art === 'gesetzlich' ? KASSEN_GESETZLICH : KASSEN_PRIVAT
}

// Prüft, ob ein Kassenname zur angegebenen Art gehört (für serverseitige
// Validierung — verhindert inkonsistente Eingaben wie „privat“ + AOK-Name).
export function istGueltigeKasse(art: KostentraegerArt, name: string): boolean {
  return kassenFuerArt(art).includes(name)
}
