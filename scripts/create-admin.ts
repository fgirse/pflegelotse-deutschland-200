// Legt einen sicheren Admin-Account an und entfernt den Demo-Zugang.
// Wiederholbar (idempotent): existiert die Admin-E-Mail schon, wird nur
// Passwort/Rolle aktualisiert. Läuft gegen die in .env konfigurierte DB
// (also gegen Atlas, wenn DATABASE_URI auf Atlas zeigt).
//
// Aufruf:
//   ADMIN_EMAIL=du@example.de pnpm run admin:create
//   ADMIN_EMAIL=du@example.de ADMIN_PASSWORD='langes-geheimnis' pnpm run admin:create
//
// Ohne ADMIN_PASSWORD wird ein starkes Zufallspasswort erzeugt und EINMALIG
// ausgegeben — dann sofort sicher notieren.
import { getPayload } from 'payload'
import { randomBytes } from 'node:crypto'
import config from '../src/payload.config'

const DEMO_MAIL = 'disponent@pflegelotse.local'

// Rolle: 'plattform_admin' (Betreiber, mandantenübergreifend) als Standard;
// per ADMIN_ROLE überschreibbar (z. B. 'admin' für Dienst-Inhaber).
type Role = 'plattform_admin' | 'admin' | 'disponent' | 'pflegekraft' | 'angehoeriger'
const ERLAUBTE_ROLLEN: Role[] = [
  'plattform_admin',
  'admin',
  'disponent',
  'pflegekraft',
  'angehoeriger',
]
const roleInput = process.env.ADMIN_ROLE ?? 'plattform_admin'
if (!ERLAUBTE_ROLLEN.includes(roleInput as Role)) {
  console.error(
    `Ungültige ADMIN_ROLE "${roleInput}". Erlaubt: ${ERLAUBTE_ROLLEN.join(', ')}`,
  )
  process.exit(1)
}
const ROLE = roleInput as Role

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!email) {
    console.error(
      'Fehlt: ADMIN_EMAIL. Beispiel:\n  ADMIN_EMAIL=du@example.de pnpm run admin:create',
    )
    process.exit(1)
  }

  // Passwort aus der Umgebung oder stark generieren (~24 Zeichen).
  let password = process.env.ADMIN_PASSWORD
  let generiert = false
  if (!password) {
    password = randomBytes(18).toString('base64url')
    generiert = true
  } else if (password.length < 12) {
    console.error('ADMIN_PASSWORD ist zu kurz (mindestens 12 Zeichen).')
    process.exit(1)
  }

  const payload = await getPayload({ config })

  // Admin anlegen oder aktualisieren.
  const vorhanden = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })

  if (vorhanden.docs.length > 0) {
    await payload.update({
      collection: 'users',
      id: vorhanden.docs[0].id,
      data: { password, role: ROLE },
      overrideAccess: true,
    })
    console.log(`Admin aktualisiert: ${email} (Rolle ${ROLE})`)
  } else {
    await payload.create({
      collection: 'users',
      // tenantId bleibt leer: Betreiber sind mandantenübergreifend.
      data: { email, password, role: ROLE },
      overrideAccess: true,
    })
    console.log(`Admin angelegt: ${email} (Rolle ${ROLE})`)
  }

  // Demo-Zugang entfernen (außer er ist zufällig der neue Admin).
  if (email !== DEMO_MAIL) {
    const del = await payload.delete({
      collection: 'users',
      where: { email: { equals: DEMO_MAIL } },
      overrideAccess: true,
    })
    const anzahl = Array.isArray(del.docs) ? del.docs.length : 0
    console.log(
      anzahl > 0
        ? `Demo-Zugang entfernt: ${DEMO_MAIL}`
        : `Kein Demo-Zugang vorhanden (${DEMO_MAIL}) — nichts zu löschen.`,
    )
  }

  if (generiert) {
    console.log('\n────────────────────────────────────────────')
    console.log('Generiertes Passwort (jetzt sicher notieren!):')
    console.log(`  ${password}`)
    console.log('────────────────────────────────────────────')
  }
  console.log('\nLogin im Payload-Admin unter /admin mit dieser E-Mail.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
