// Reine Aggregation der §5.4-Berichte (Mitarbeiterauslastung, Kilometernachweis).
// Nimmt bereits je Tour berechnete Kennzahlen und gruppiert nach Pflegekraft.

export interface TourKennzahl {
  pflegekraftId: string
  datum: string
  fahrzeitMin: number
  arbeitszeitMin: number
  amKlientenMin: number // Pflege- + Grundzeit
  einsaetze: number
  km: number
}

export interface MitarbeiterZeile {
  pflegekraftId: string
  touren: number
  einsaetze: number
  arbeitszeitMin: number
  fahrzeitMin: number
  amKlientenMin: number
  auslastungProzent: number // amKlienten / (amKlienten + Fahrzeit)
  km: number
}

export interface KilometerZeile {
  datum: string
  pflegekraftId: string
  km: number
  fahrzeitMin: number
}

export interface Berichte {
  mitarbeiter: MitarbeiterZeile[]
  kilometer: KilometerZeile[]
}

export function aggregiereBerichte(touren: TourKennzahl[]): Berichte {
  const proKraft = new Map<string, MitarbeiterZeile>()
  const kilometer: KilometerZeile[] = []

  for (const t of touren) {
    kilometer.push({ datum: t.datum, pflegekraftId: t.pflegekraftId, km: t.km, fahrzeitMin: t.fahrzeitMin })

    const z =
      proKraft.get(t.pflegekraftId) ??
      {
        pflegekraftId: t.pflegekraftId,
        touren: 0,
        einsaetze: 0,
        arbeitszeitMin: 0,
        fahrzeitMin: 0,
        amKlientenMin: 0,
        auslastungProzent: 0,
        km: 0,
      }
    z.touren += 1
    z.einsaetze += t.einsaetze
    z.arbeitszeitMin += t.arbeitszeitMin
    z.fahrzeitMin += t.fahrzeitMin
    z.amKlientenMin += t.amKlientenMin
    z.km = Math.round((z.km + t.km) * 10) / 10
    proKraft.set(t.pflegekraftId, z)
  }

  // Auslastung je Kraft aus den Summen; nach Pflegekraft sortiert.
  const mitarbeiter = [...proKraft.values()]
    .map((z) => {
      const nenner = z.amKlientenMin + z.fahrzeitMin
      return { ...z, auslastungProzent: nenner > 0 ? Math.round((z.amKlientenMin / nenner) * 100) : 0 }
    })
    .sort((a, b) => a.pflegekraftId.localeCompare(b.pflegekraftId))

  // Kilometer chronologisch, dann nach Kraft.
  kilometer.sort((a, b) => a.datum.localeCompare(b.datum) || a.pflegekraftId.localeCompare(b.pflegekraftId))

  return { mitarbeiter, kilometer }
}
