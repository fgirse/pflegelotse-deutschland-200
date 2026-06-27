import { payloadClient } from '@/server/payloadClient'
import { getNotifier } from '@/server/notify/Notifier'
import { holeKontaktIntern, bedarfAusDoc, entferneProbeEinsaetze } from '@/server/marketplace/service'
import { istAbgelaufen, slaKennzahlen, type SlaKennzahlen } from './deadline'
import { bedarfSchema } from '@/shared/marketplace'

// Verarbeitet abgelaufene Bedarfe (/F430/): findet alle offenen/in Bearbeitung
// befindlichen Bedarfe, deren Frist verstrichen ist, setzt sie auf „abgesagt"
// und schickt der Angehörigen eine klare automatische Absage.
// Wird vom Cron-Endpoint aufgerufen. Idempotent.
export async function verarbeiteAbgelaufeneBedarfe(
  now: Date,
): Promise<{ geprueft: number; abgesagt: number }> {
  const payload = await payloadClient()
  const notifier = getNotifier()
  const nowMs = now.getTime()

  const res = await payload.find({
    collection: 'bedarfe',
    where: { status: { in: ['offen', 'in_bearbeitung'] } },
    limit: 500,
    overrideAccess: true,
    depth: 0,
  })

  const faellig = res.docs
    .map((d) => bedarfSchema.parse(bedarfAusDoc(d)))
    .filter((b) => istAbgelaufen(b, nowMs))

  for (const b of faellig) {
    await payload.update({
      collection: 'bedarfe',
      where: { pseudonymId: { equals: b.pseudonymId } },
      data: { status: 'abgesagt' },
      overrideAccess: true,
    })

    // Abgesagt → etwaige Probe-Einplanungen aus allen Touren entfernen.
    await entferneProbeEinsaetze(b.pseudonymId)

    // Klare Absage an die Angehörige (an ihre eigene Adresse — kein Leak).
    const kontakt = await holeKontaktIntern(b.pseudonymId)
    if (kontakt?.email) {
      await notifier
        .sende(
          kontakt.email,
          'Leider kein passendes Angebot innerhalb der Frist',
          `<p>Hallo ${kontakt.vorname},</p>` +
            `<p>zu Ihrem Pflegebedarf ist innerhalb der Frist kein verbindliches Angebot ` +
            `eingegangen. Der Bedarf wurde daher automatisch geschlossen. Sie können jederzeit ` +
            `einen neuen Bedarf einstellen.</p>`,
          `${b.pseudonymId}:absage`,
        )
        .catch((e) => console.error('Absage-Mail fehlgeschlagen:', e))
    }
  }

  return { geprueft: res.docs.length, abgesagt: faellig.length }
}

// SLA-Kennzahlen über alle Bedarfe (/F440/): Rückmeldequote, Zeit bis erste Reaktion.
export async function slaStats(): Promise<SlaKennzahlen> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'bedarfe',
    limit: 1000,
    overrideAccess: true,
    depth: 0,
  })
  const bedarfe = res.docs.map((d) => bedarfSchema.parse(bedarfAusDoc(d)))
  return slaKennzahlen(bedarfe)
}
