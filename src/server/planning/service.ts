import { ladeStammtouren, ladeGenerierteTourKeys, erstelleGenerierteTour } from '@/server/repo'
import { generiereWoche, wocheDaten, montagDerWoche, filtereNeue } from './wochenplan'

// Generiert den Wochenrahmenplan (Pflichtenheft 5.2.2): aus den Stammtouren des
// Mandanten werden für die Woche des gegebenen Datums konkrete Touren angelegt.
// Idempotent — bereits generierte Tag-Touren (inkl. manueller Änderungen)
// bleiben erhalten, nur fehlende Tage werden ergänzt.
export async function generiereWochenplan(tenantId: string, datum: string) {
  const montag = montagDerWoche(datum)
  const stammtouren = await ladeStammtouren(tenantId)
  const alle = generiereWoche(stammtouren, montag)
  const vorhandene = await ladeGenerierteTourKeys(tenantId, wocheDaten(montag))
  const neue = filtereNeue(alle, vorhandene)
  for (const e of neue) await erstelleGenerierteTour(e)
  return {
    montag,
    gesamt: alle.length,
    erzeugt: neue.length,
    uebersprungen: alle.length - neue.length,
  }
}
