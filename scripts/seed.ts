// Erzeugt synthetische, fiktive Demodaten für die Pilotregion Freiburg.
// HARTE REGEL: niemals echte Klientendaten in Dev/CI/Staging.
// Aufruf: pnpm run db:seed
import { getPayload } from 'payload'
import { randomUUID } from 'node:crypto'
import config from '../src/payload.config'

const TENANT = 'demo'

// Depot (Pflegedienst-Standort) und Klienten rund um Freiburg.
const DEPOT = { lat: 47.995, lng: 7.85 }

// hh:mm → Minuten seit Mitternacht
const m = (h: number, min = 0) => h * 60 + min

interface SeedKlient {
  vorname: string
  nachname: string
  adresse: string
  geo: { lat: number; lng: number }
  pflegegrad: number
  qualifikation: string[]
  leistungen: string[]
  zeitfenster: { von: number; bis: number }
  dauerMin: number
}

const klienten: SeedKlient[] = [
  { vorname: 'Anna', nachname: 'Bauer', adresse: 'Habsburgerstr. 1, Freiburg', geo: { lat: 48.012, lng: 7.853 }, pflegegrad: 3, qualifikation: ['grundpflege'], leistungen: ['LK01'], zeitfenster: { von: m(8), bis: m(9) }, dauerMin: 30 },
  { vorname: 'Bernd', nachname: 'Conrad', adresse: 'Kaiser-Joseph-Str. 200, Freiburg', geo: { lat: 47.995, lng: 7.852 }, pflegegrad: 2, qualifikation: ['grundpflege'], leistungen: ['LK01'], zeitfenster: { von: m(8, 30), bis: m(9, 30) }, dauerMin: 25 },
  { vorname: 'Clara', nachname: 'Diehl', adresse: 'Günterstalstr. 50, Freiburg', geo: { lat: 47.982, lng: 7.849 }, pflegegrad: 4, qualifikation: ['behandlungspflege'], leistungen: ['LK15'], zeitfenster: { von: m(9), bis: m(10) }, dauerMin: 40 },
  { vorname: 'Dieter', nachname: 'Engel', adresse: 'Schwarzwaldstr. 120, Freiburg', geo: { lat: 47.992, lng: 7.876 }, pflegegrad: 2, qualifikation: ['grundpflege'], leistungen: ['LK01'], zeitfenster: { von: m(9, 30), bis: m(10, 30) }, dauerMin: 20 },
  // Unzugeordnete Kandidaten (Lücken füllen):
  { vorname: 'Erika', nachname: 'Fuchs', adresse: 'Wiehre, Freiburg', geo: { lat: 47.988, lng: 7.851 }, pflegegrad: 3, qualifikation: ['grundpflege'], leistungen: ['LK01'], zeitfenster: { von: m(8, 30), bis: m(10) }, dauerMin: 30 },
  { vorname: 'Frank', nachname: 'Gruber', adresse: 'Stühlinger, Freiburg', geo: { lat: 47.998, lng: 7.838 }, pflegegrad: 5, qualifikation: ['behandlungspflege'], leistungen: ['LK15'], zeitfenster: { von: m(9), bis: m(11) }, dauerMin: 45 },
  { vorname: 'Gisela', nachname: 'Hahn', adresse: 'Herdern, Freiburg', geo: { lat: 48.013, lng: 7.846 }, pflegegrad: 2, qualifikation: ['grundpflege'], leistungen: ['LK01'], zeitfenster: { von: m(8), bis: m(12) }, dauerMin: 20 },
]

async function main() {
  const payload = await getPayload({ config })

  // Demo-Disponent anlegen (falls noch nicht vorhanden).
  const userMail = 'disponent@pflegelotse.local'
  const vorhandeneUser = await payload.find({
    collection: 'users',
    where: { email: { equals: userMail } },
    limit: 1,
  })
  if (vorhandeneUser.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: { email: userMail, password: 'demo12345', role: 'disponent', tenantId: TENANT },
    })
    console.log(`Demo-Disponent angelegt: ${userMail} / demo12345`)
  }

  // Klienten in beide Säulen schreiben.
  const ids: { pseudonymId: string; k: SeedKlient }[] = []
  for (const k of klienten) {
    const pseudonymId = randomUUID()
    await payload.create({
      collection: 'klienten_identitaet',
      data: {
        pseudonymId,
        tenantId: TENANT,
        externalId: `seed-${k.nachname}`,
        vorname: k.vorname,
        nachname: k.nachname,
        adresse: k.adresse,
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'klienten_operativ',
      data: {
        pseudonymId,
        tenantId: TENANT,
        geo: k.geo,
        pflegegrad: k.pflegegrad,
        leistungen: k.leistungen,
        qualifikation: k.qualifikation,
        zeitfenster: k.zeitfenster,
        dauerMin: k.dauerMin,
        status: 'aktiv',
      },
      overrideAccess: true,
    })
    ids.push({ pseudonymId, k })
  }

  // Eine Tour mit den ersten vier Klienten als Einsätze; der Rest bleibt
  // als zu füllende Lücke übrig.
  const tourEinsaetze = ids.slice(0, 4).map(({ pseudonymId, k }) => ({
    pseudonymId,
    geo: k.geo,
    zeitfenster: k.zeitfenster,
    dauerMin: k.dauerMin,
    qualifikation: k.qualifikation,
  }))

  await payload.create({
    collection: 'touren',
    data: {
      tenantId: TENANT,
      datum: '2026-06-25',
      pflegekraftId: 'pk-001',
      // Kraft kann beide Qualifikationen — sonst fänden behandlungspflege-Kandidaten keine Tour.
      pflegekraftQualifikation: ['grundpflege', 'behandlungspflege'],
      start: DEPOT,
      startZeit: m(8),
      einsaetze: tourEinsaetze,
    },
    overrideAccess: true,
  })

  console.log(`Seed fertig: ${ids.length} Klienten, 1 Tour, Mandant "${TENANT}".`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
