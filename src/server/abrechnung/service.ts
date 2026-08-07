import { env } from '@/lib/env'
import { verifiziereKette } from '@/server/nachweis/kette'
import { ladeNachweise, ladeKlientenOperativ, ladeIdentitaeten, ladeAbrechnungskonfig } from '@/server/repo'
import { aggregiere, type KlientInfo, type Aggregat } from './aggregat'
import { baueDatevStapel } from './datev'
import { baueKassenCsv } from './kassen'

// Sammelt die bepreisten Positionen für einen Zeitraum aus den revisionssicheren
// Nachweisen. Die Ketten-Integrität des GESAMTEN Mandanten-Journals wird geprüft
// (Warnung, falls gebrochen), erst dann auf den Zeitraum gefiltert.
async function sammle(tenantId: string, von: string, bis: string) {
  const konfig = await ladeAbrechnungskonfig(tenantId)
  const alle = await ladeNachweise(tenantId)
  const integritaet = verifiziereKette(alle, env.AUDIT_PEPPER).gueltig
  const imZeitraum = alle.filter((e) => e.datum >= von && e.datum <= bis)

  const pids = [...new Set(imZeitraum.map((e) => e.pseudonymId))]
  const [klientenOp, namen] = await Promise.all([ladeKlientenOperativ(tenantId), ladeIdentitaeten(tenantId, pids)])
  const opMap = new Map(klientenOp.map((k) => [k.pseudonymId, k]))
  const klienten = new Map<string, KlientInfo>(
    pids.map((pid) => {
      const op = opMap.get(pid)
      return [
        pid,
        { name: namen.get(pid) ?? 'Unbekannt', kostentraegerArt: op?.kostentraegerArt, versicherung: op?.krankenversicherer },
      ]
    }),
  )

  const agg: Aggregat = aggregiere(imZeitraum, konfig?.preise ?? {}, klienten, konfig?.preisePrivat ?? {})
  return { agg, konfig, integritaet }
}

// DATEV-EXTF-Buchungsstapel für den Zeitraum. `stamp` = Erzeugungszeitstempel
// (YYYYMMDDHHMMSSFFF), injiziert für Determinismus.
export async function exportiereDatev(tenantId: string, von: string, bis: string, stamp: string) {
  const { agg, konfig, integritaet } = await sammle(tenantId, von, bis)
  return {
    csv: baueDatevStapel(agg.buchungen, konfig ?? {}, von, bis, stamp),
    integritaet,
    summeEuro: agg.summeEuro,
    anzahl: agg.buchungen.length,
  }
}

// Abrechnungsvorbereitendes Kassen-CSV (bepreiste Positionen) für den Zeitraum.
export async function exportiereKassen(tenantId: string, von: string, bis: string) {
  const { agg, integritaet } = await sammle(tenantId, von, bis)
  return {
    csv: baueKassenCsv(agg.positionen),
    integritaet,
    summeEuro: agg.summeEuro,
    anzahl: agg.positionen.length,
  }
}
