import type { Bedarf } from '@/shared/marketplace'

// ── SLA-Kernlogik (rein, ohne I/O — daher gut testbar) ───────────────────

// Frist bis zur verbindlichen Rückmeldung (/F430/). Express-Bedarfe (/F350/)
// werden mit kürzerer Frist priorisiert.
export const FRIST_STD_MIN = 24 * 60 // 24 Stunden
export const FRIST_EXPRESS_MIN = 4 * 60 // 4 Stunden

export function berechneDeadline(createdAtMs: number, express: boolean): string {
  const fristMin = express ? FRIST_EXPRESS_MIN : FRIST_STD_MIN
  return new Date(createdAtMs + fristMin * 60_000).toISOString()
}

// Ist die Frist abgelaufen, ohne dass der Bedarf vergeben oder schon abgesagt
// wurde? Nur dann greift die automatische Absage.
export function istAbgelaufen(
  bedarf: Pick<Bedarf, 'status' | 'deadlineAt'>,
  nowMs: number,
): boolean {
  if (bedarf.status !== 'offen' && bedarf.status !== 'in_bearbeitung') return false
  if (!bedarf.deadlineAt) return false
  return new Date(bedarf.deadlineAt).getTime() <= nowMs
}

export interface SlaKennzahlen {
  gesamt: number
  offen: number
  inBearbeitung: number
  vergeben: number
  abgesagt: number
  mitAngebot: number
  // Rückmeldequote = Anteil der Bedarfe mit mindestens einer Reaktion.
  rueckmeldequote: number
  // Durchschnittliche Zeit bis zur ersten Reaktion (Minuten).
  avgReaktionMin: number | null
}

// Aggregiert SLA-Kennzahlen über eine Bedarfsliste (/F440/).
export function slaKennzahlen(
  bedarfe: Array<Pick<Bedarf, 'status' | 'createdAt' | 'firstResponseAt'>>,
): SlaKennzahlen {
  const gesamt = bedarfe.length
  const zaehle = (s: Bedarf['status']) => bedarfe.filter((b) => b.status === s).length
  const mitAngebot = bedarfe.filter((b) => Boolean(b.firstResponseAt)).length

  // Reaktionszeiten nur dort, wo beide Zeitstempel vorliegen.
  const reaktionen = bedarfe
    .filter((b) => b.firstResponseAt && b.createdAt)
    .map(
      (b) =>
        (new Date(b.firstResponseAt!).getTime() - new Date(b.createdAt!).getTime()) / 60_000,
    )
  const avgReaktionMin =
    reaktionen.length > 0
      ? Math.round((reaktionen.reduce((a, b) => a + b, 0) / reaktionen.length) * 10) / 10
      : null

  return {
    gesamt,
    offen: zaehle('offen'),
    inBearbeitung: zaehle('in_bearbeitung'),
    vergeben: zaehle('vergeben'),
    abgesagt: zaehle('abgesagt'),
    mitAngebot,
    rueckmeldequote: gesamt > 0 ? Math.round((mitAngebot / gesamt) * 100) / 100 : 0,
    avgReaktionMin,
  }
}
