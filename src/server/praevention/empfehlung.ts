import { HANDLUNGSFELDER, handlungsfeld } from './katalog'
import type { FeldErhebung, Empfehlung } from '@/shared/praevention'

// Generiert Präventionsvorschläge aus der Erhebung (/F920/): für jedes
// Handlungsfeld mit mindestens einem markierten Risiko wird das zugehörige
// §20-SGB-V-Angebot vorgeschlagen, mit Begründung aus den markierten Risiken.
// Rein und deterministisch — die fachliche Entscheidung trifft die Pflegekraft.
export function generiereEmpfehlungen(felder: FeldErhebung[]): Empfehlung[] {
  const empfehlungen: Empfehlung[] = []
  for (const feld of felder) {
    if (!feld.risiken || feld.risiken.length === 0) continue
    const hf = handlungsfeld(feld.feldId)
    if (!hf) continue

    // Risiko-IDs in lesbare Labels übersetzen (nur bekannte).
    const labels = feld.risiken
      .map((rid) => hf.risiken.find((r) => r.id === rid)?.label)
      .filter((l): l is string => Boolean(l))
    if (labels.length === 0) continue

    empfehlungen.push({
      handlungsfeld: hf.titel,
      titel: hf.angebot.titel,
      beschreibung: hf.angebot.beschreibung,
      paragraf20: hf.paragraf20,
      begruendung: `Hinweise: ${labels.join(', ')}.`,
    })
  }
  return empfehlungen
}

// Erzeugt das exportierbare Dokument (Markdown) für die Pflegekasse (/F930/).
// Enthält keine PII — nur die pseudonyme Kennung.
export function baueDokument(p: {
  pseudonymId: string
  status: string
  felder: FeldErhebung[]
  empfehlungen: Empfehlung[]
  freitext?: string
  erstelltVon?: string
  datum: string
}): string {
  const z: string[] = []
  z.push('# Präventionsempfehlung (§5 Abs. 1a SGB XI / BEEP)')
  z.push('')
  z.push(`- Pseudonyme Kennung: ${p.pseudonymId}`)
  z.push(`- Erstellt am: ${p.datum}`)
  if (p.erstelltVon) z.push(`- Erstellt von: ${p.erstelltVon}`)
  z.push(`- Status: ${p.status}`)
  z.push('')
  z.push('## Ressourcenorientierte Erhebung')
  for (const feld of p.felder) {
    const hf = HANDLUNGSFELDER.find((h) => h.id === feld.feldId)
    if (!hf) continue
    const risikoLabels = feld.risiken
      .map((rid) => hf.risiken.find((r) => r.id === rid)?.label)
      .filter(Boolean)
    z.push(`### ${hf.titel}`)
    z.push(`- Ressourcen: ${feld.ressourcen?.trim() || '—'}`)
    z.push(`- Risiken: ${risikoLabels.length ? risikoLabels.join(', ') : 'keine markiert'}`)
    z.push('')
  }
  z.push('## Empfohlene Präventionsangebote (§20 SGB V)')
  if (p.empfehlungen.length === 0) {
    z.push('- Keine Angebote empfohlen.')
  } else {
    for (const e of p.empfehlungen) {
      z.push(`### ${e.titel} (${e.paragraf20})`)
      z.push(`- ${e.beschreibung}`)
      z.push(`- ${e.begruendung}`)
      z.push('')
    }
  }
  if (p.freitext?.trim()) {
    z.push('## Anmerkungen der Pflegefachkraft')
    z.push(p.freitext.trim())
    z.push('')
  }
  z.push('---')
  z.push(
    '_Fachliche Entscheidung und Verantwortung liegen bei der Pflegefachkraft. ' +
      'Keine medizinische Diagnose; bei medizinischen Fragen Verweis auf §7a-Beratung._',
  )
  return z.join('\n')
}
