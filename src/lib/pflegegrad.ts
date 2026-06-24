// Pflegegrad-Rechner auf Basis des Neuen Begutachtungsassessments (NBA).
// REIN und clientseitig — keine PII, kein Server (/F720/).
//
// WICHTIG: Dies ist eine unverbindliche Orientierung. Der Pflegegrad wird
// amtlich vom Medizinischen Dienst festgestellt; dieses Werkzeug ersetzt keine
// Begutachtung und keine Beratung.
//
// Modell: 6 Module mit amtlicher Gewichtung (10/15/40/20/15 %). Die Module 2
// und 3 zählen gemeinsam 15 % (hier als ein kombiniertes Modul erfasst). Jedes
// Modul wird auf einer 5-stufigen Schweregrad-Skala eingeschätzt; die gewichteten
// Punkte je Stufe entsprechen den NBA-Höchstwerten des jeweiligen Moduls.

export type Schweregrad = 0 | 1 | 2 | 3 | 4 // keine … schwerste

export interface PflegegradModul {
  id: string
  titel: string
  beschreibung: string
  // Gewichtete Punkte je Schweregrad (Index 0–4). Summe der Max-Werte = 100.
  punkteJeStufe: [number, number, number, number, number]
}

export const PFLEGEGRAD_MODULE: PflegegradModul[] = [
  {
    id: 'mobilitaet',
    titel: 'Mobilität',
    beschreibung: 'Aufstehen, Umsetzen, Gehen, Treppensteigen',
    punkteJeStufe: [0, 2.5, 5, 7.5, 10], // 10 %
  },
  {
    id: 'kognition',
    titel: 'Kognitive/kommunikative Fähigkeiten & Verhalten',
    beschreibung: 'Gedächtnis, Orientierung, psychische Problemlagen (Module 2 und 3)',
    punkteJeStufe: [0, 3.75, 7.5, 11.25, 15], // 15 % (höherer Wert aus Modul 2/3)
  },
  {
    id: 'selbstversorgung',
    titel: 'Selbstversorgung',
    beschreibung: 'Waschen, An-/Auskleiden, Essen, Toilettengang',
    punkteJeStufe: [0, 10, 20, 30, 40], // 40 %
  },
  {
    id: 'therapie',
    titel: 'Umgang mit krankheits-/therapiebedingten Anforderungen',
    beschreibung: 'Medikamente, Verbände, Arztbesuche, Therapien',
    punkteJeStufe: [0, 5, 10, 15, 20], // 20 %
  },
  {
    id: 'alltag',
    titel: 'Gestaltung des Alltags & soziale Kontakte',
    beschreibung: 'Tagesgestaltung, Kontakte, Beschäftigung',
    punkteJeStufe: [0, 3.75, 7.5, 11.25, 15], // 15 %
  },
]

export interface PflegegradErgebnis {
  punkte: number // gewichtete Gesamtpunkte 0–100
  grad: 0 | 1 | 2 | 3 | 4 | 5 // 0 = kein Pflegegrad
  label: string
}

// Schwellenwerte laut SGB XI (gewichtete Gesamtpunkte → Pflegegrad).
function gradAusPunkten(punkte: number): PflegegradErgebnis['grad'] {
  if (punkte < 12.5) return 0
  if (punkte < 27) return 1
  if (punkte < 47.5) return 2
  if (punkte < 70) return 3
  if (punkte < 90) return 4
  return 5
}

const LABELS: Record<PflegegradErgebnis['grad'], string> = {
  0: 'Kein Pflegegrad',
  1: 'Pflegegrad 1 (geringe Beeinträchtigung)',
  2: 'Pflegegrad 2 (erhebliche Beeinträchtigung)',
  3: 'Pflegegrad 3 (schwere Beeinträchtigung)',
  4: 'Pflegegrad 4 (schwerste Beeinträchtigung)',
  5: 'Pflegegrad 5 (schwerste Beeinträchtigung mit besonderen Anforderungen)',
}

// Berechnet die gewichteten Gesamtpunkte und den Pflegegrad aus der Einschätzung
// je Modul. Fehlende Module zählen als Schweregrad 0.
export function berechnePflegegrad(
  auswahl: Record<string, Schweregrad>,
): PflegegradErgebnis {
  let punkte = 0
  for (const modul of PFLEGEGRAD_MODULE) {
    const stufe = auswahl[modul.id] ?? 0
    punkte += modul.punkteJeStufe[stufe] ?? 0
  }
  // Auf zwei Nachkommastellen runden (NBA-Punkte treten in 0,25er-Schritten auf).
  punkte = Math.round(punkte * 100) / 100
  const grad = gradAusPunkten(punkte)
  return { punkte, grad, label: LABELS[grad] }
}
