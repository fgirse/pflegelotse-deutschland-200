import { env } from '@/lib/env'
import { minToHHMM } from '@/shared/time'
import {
  ladeTour,
  ladeKlientenOperativ,
  ladeKettenKopf,
  erstelleNachweis,
  ladeNachweise,
  ladeKlientIdentitaet,
  speichereEinsaetze,
  type KlientIdentitaet,
} from '@/server/repo'
import { naechsterEintrag, verifiziereKette, type NachweisKern, type NachweisEintrag } from './kette'

// Bestätigt die erbrachten Leistungen eines Besuchs (§5.4) und hängt einen
// revisionssicheren, hash-verketteten Nachweis-Eintrag an. Rückgabe: null =
// Tour nicht gefunden; { ungueltig } = Einsatz gehört nicht zur Tour.
export async function bestaetigeLeistung(
  tenantId: string,
  tourId: string,
  daten: { pseudonymId: string; erbrachteLeistungen?: string[]; bestaetigtVon: string; zeit?: number },
) {
  const tour = await ladeTour(tourId)
  if (!tour || tour.tenantId !== tenantId) return null
  const einsatz = tour.einsaetze.find((e) => e.pseudonymId === daten.pseudonymId)
  if (!einsatz) return { ungueltig: true as const }

  // Erbrachte Leistungen: explizit angegeben, sonst die geplanten des Klienten.
  let erbracht = daten.erbrachteLeistungen
  if (!erbracht) {
    const klienten = await ladeKlientenOperativ(tenantId)
    erbracht = klienten.find((k) => k.pseudonymId === daten.pseudonymId)?.leistungen ?? []
  }

  const kern: NachweisKern = {
    pseudonymId: daten.pseudonymId,
    datum: tour.datum,
    tourId,
    erbrachteLeistungen: erbracht,
    istAnkunft: einsatz.istAnkunft ?? daten.zeit,
    istAbfahrt: daten.zeit,
    bestaetigtAm: new Date().toISOString(),
    bestaetigtVon: daten.bestaetigtVon,
  }
  const kopf = await ladeKettenKopf(tenantId)
  const eintrag = naechsterEintrag(kern, kopf, env.AUDIT_PEPPER)
  await erstelleNachweis(tenantId, eintrag, env.AUDIT_PEPPER_VERSION)

  // Operativ den Einsatz als erledigt markieren (Abfahrtszeit stempeln).
  const einsaetze = tour.einsaetze.map((e) =>
    e.pseudonymId === daten.pseudonymId ? { ...e, erledigt: true, istAbfahrt: daten.zeit ?? e.istAbfahrt } : e,
  )
  await speichereEinsaetze(tourId, einsaetze)

  return { ok: true as const, hash: eintrag.hash }
}

// Prüft die gesamte Nachweis-Kette eines Mandanten (Revisionssicherheit).
export async function verifiziereNachweisKette(tenantId: string) {
  const alle = await ladeNachweise(tenantId)
  return { ...verifiziereKette(alle, env.AUDIT_PEPPER), anzahl: alle.length }
}

// Erzeugt das Leistungsnachweis-Dokument (Markdown) für einen Klienten: verbindet
// die pseudonymen Säule-2-Einträge mit der Identität aus Säule 1 (nur zur
// Darstellung) und weist den Integritätsstatus der Kette aus.
export async function erzeugeNachweisDokument(tenantId: string, pseudonymId: string) {
  const alle = await ladeNachweise(tenantId)
  const pruef = verifiziereKette(alle, env.AUDIT_PEPPER)
  const eintraege = alle.filter((e) => e.pseudonymId === pseudonymId)
  if (eintraege.length === 0) return null
  const ident = await ladeKlientIdentitaet(tenantId, pseudonymId)
  const name = [ident?.vorname, ident?.nachname].filter(Boolean).join(' ') || 'Unbekannt'
  return {
    integritaet: pruef.gueltig,
    klient: { name, adresse: ident?.adresse ?? null },
    eintraege: eintraege.map((e) => ({
      datum: e.datum,
      istAnkunft: e.istAnkunft ?? null,
      istAbfahrt: e.istAbfahrt ?? null,
      erbrachteLeistungen: e.erbrachteLeistungen,
      bestaetigtVon: e.bestaetigtVon,
    })),
    markdown: baueMarkdown(ident, eintraege, pruef.gueltig),
  }
}

function baueMarkdown(ident: KlientIdentitaet | null, eintraege: NachweisEintrag[], integer: boolean): string {
  const name = [ident?.vorname, ident?.nachname].filter(Boolean).join(' ') || 'Unbekannt'
  const zeilen = eintraege.map((e) => {
    const von = e.istAnkunft != null ? minToHHMM(e.istAnkunft) : '—'
    const bis = e.istAbfahrt != null ? minToHHMM(e.istAbfahrt) : '—'
    const leist = e.erbrachteLeistungen.join(', ') || '—'
    return `| ${e.datum} | ${von}–${bis} | ${leist} | ${e.bestaetigtVon} |`
  })
  const teile: string[] = ['# Leistungsnachweis', '', `**Klient:** ${name}`]
  if (ident?.adresse) teile.push(`**Adresse:** ${ident.adresse}`)
  teile.push(
    '',
    integer
      ? `> ✓ Integrität bestätigt — die Aufzeichnung ist seit der Erfassung unverändert (Hash-Kette geprüft).`
      : `> ⚠ Integrität NICHT bestätigt — die Hash-Kette ist gebrochen. Bitte prüfen.`,
    '',
    `| Datum | Zeit | Erbrachte Leistungen | Bestätigt von |`,
    `|---|---|---|---|`,
    ...zeilen,
    '',
    `_${eintraege.length} bestätigte Einsätze. Erzeugt am ${new Date().toISOString().slice(0, 10)}._`,
  )
  return teile.join('\n')
}
