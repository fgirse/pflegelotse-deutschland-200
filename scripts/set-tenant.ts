// Weist einem Nutzer eine tenantId (Mandant/Pflegedienst) zu. Ohne tenantId
// werden Dienst-Mitarbeiter (disponent/admin/pflegekraft) nach erfolgreicher
// 2FA vom Dashboard zurück zum Login geleitet — sie sehen sonst keine Daten.
//
// Aufruf:
//   USER_EMAIL=person@dienst.de TENANT_ID=mein-dienst pnpm run user:tenant
//
// Die tenantId ist der Daten-Partitionsschlüssel: Klienten, Touren und Bedarfe
// hängen daran. Vor dem Anlegen von Daten frei wählbar; danach NICHT mehr
// gefahrlos änderbar (würde bestehende Daten abkoppeln).
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  const email = process.env.USER_EMAIL?.trim().toLowerCase()
  const tenantId = process.env.TENANT_ID?.trim()
  if (!email || !tenantId) {
    console.error(
      'Fehlt: USER_EMAIL und/oder TENANT_ID.\n' +
        '  USER_EMAIL=person@dienst.de TENANT_ID=mein-dienst pnpm run user:tenant',
    )
    process.exit(1)
  }

  const payload = await getPayload({ config })
  const gefunden = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  if (gefunden.docs.length === 0) {
    console.error(`Kein Nutzer mit E-Mail ${email} gefunden.`)
    process.exit(1)
  }

  const user = gefunden.docs[0] as { id: string | number; tenantId?: string }
  console.log(`Vorher: ${email} | tenantId=${user.tenantId ?? '(LEER)'}`)
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { tenantId },
    overrideAccess: true,
  })
  console.log(`Nachher: ${email} | tenantId=${tenantId}`)
  console.log('Fertig. Der Nutzer kann sich jetzt nach 2FA im Dashboard anmelden.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
