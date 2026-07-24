import type { Stammtour, Tour } from '@/shared/domain'

// ── Wochenplanung aus Stammtouren (Pflichtenheft 5.2.2) ───────────────────
// Reine, deterministische Funktionen: aus Stammtouren + Montag einer Woche
// werden konkrete Tour-Entwürfe erzeugt. Keine DB, keine Zeitzonen-Effekte
// (Datumsarithmetik in UTC).

// Ein Tour-Entwurf ist eine Tour ohne die von der DB vergebene id.
export type TourEntwurf = Omit<Tour, 'id'>

const TAG_MS = 86_400_000

// ISO-Wochentag (Mo=1 … So=7) aus einem YYYY-MM-DD-String, in UTC gerechnet.
export function isoWochentag(datum: string): number {
  const [y, m, d] = datum.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=So … 6=Sa
  return wd === 0 ? 7 : wd
}

// YYYY-MM-DD eines UTC-Zeitstempels.
function fmt(ms: number): string {
  const dt = new Date(ms)
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${mm}-${dd}`
}

// Montag der Woche, die das gegebene Datum enthält (robust gegen beliebige
// Eingabetage — der Aufrufer muss nicht selbst auf Montag normalisieren).
export function montagDerWoche(datum: string): string {
  const [y, m, d] = datum.split('-').map(Number)
  const basis = Date.UTC(y, m - 1, d)
  const wd = isoWochentag(datum) // 1..7
  return fmt(basis - (wd - 1) * TAG_MS)
}

// Die sieben Datumsstrings einer Woche ab dem gegebenen Montag (inklusive).
export function wocheDaten(montagISO: string): string[] {
  const [y, m, d] = montagISO.split('-').map(Number)
  const basis = Date.UTC(y, m - 1, d)
  return Array.from({ length: 7 }, (_, i) => fmt(basis + i * TAG_MS))
}

// Baut die konkreten Tour-Entwürfe einer Woche aus den Stammtouren. Pro Tag und
// Stammtour, deren wochentage-Set den Tag enthält (und die im Gültigkeitsraum
// liegt), entsteht eine Tour mit den an dem Tag fälligen Einsätzen. Leere
// Touren (kein Einsatz an dem Tag) werden nicht erzeugt.
export function generiereWoche(stammtouren: Stammtour[], montagISO: string): TourEntwurf[] {
  const entwuerfe: TourEntwurf[] = []
  for (const datum of wocheDaten(montagISO)) {
    const wd = isoWochentag(datum)
    for (const st of stammtouren) {
      if (!st.wochentage.includes(wd)) continue
      if (st.aktivAb && datum < st.aktivAb) continue
      if (st.aktivBis && datum > st.aktivBis) continue

      // Einsätze, die an diesem Wochentag fällig sind (eigenes Set oder das der Tour).
      const einsaetze = st.einsaetze
        .filter((e) => (e.wochentage ?? st.wochentage).includes(wd))
        .map((e) => ({
          pseudonymId: e.pseudonymId,
          geo: e.geo,
          zeitfenster: e.zeitfenster,
          dauerMin: e.dauerMin,
          grundzeitMin: e.grundzeitMin,
          qualifikation: e.qualifikation,
        }))
      if (einsaetze.length === 0) continue

      entwuerfe.push({
        tenantId: st.tenantId,
        datum,
        pflegekraftId: st.pflegekraftId,
        pflegekraftQualifikation: st.pflegekraftQualifikation,
        pflegekraftGeschlecht: st.pflegekraftGeschlecht,
        start: st.start,
        ende: st.ende,
        startZeit: st.startZeit,
        verfuegbarBis: st.verfuegbarBis,
        maxEinsaetze: st.maxEinsaetze,
        stammtourId: st.id,
        einsaetze,
      })
    }
  }
  return entwuerfe
}

// Idempotenz-Schlüssel: eine generierte Tour ist über (Stammtour, Datum) eindeutig.
export function tourSchluessel(e: { stammtourId?: string; datum: string }): string {
  return `${e.stammtourId ?? ''}|${e.datum}`
}

// Behält nur Entwürfe, für die noch keine generierte Tour existiert — bestehende
// Tag-Touren (inkl. manueller Änderungen des Disponenten) bleiben unangetastet.
export function filtereNeue(entwuerfe: TourEntwurf[], vorhandene: Set<string>): TourEntwurf[] {
  return entwuerfe.filter((e) => !vorhandene.has(tourSchluessel(e)))
}
