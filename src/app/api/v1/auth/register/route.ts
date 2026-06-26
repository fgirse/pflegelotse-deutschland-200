import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { payloadClient } from '@/server/payloadClient'
import { registrierungSchema } from '@/shared/registrierung'

export const dynamic = 'force-dynamic'

// Erzeugt aus dem Dienstnamen eine eindeutige, URL-taugliche tenantId.
function tenantIdAus(name: string): string {
  const slug =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'dienst'
  return `${slug}-${randomBytes(3).toString('hex')}`
}

// POST /api/v1/auth/register — öffentliche Selbstregistrierung für beide
// Zielgruppen. Rolle und Mandant werden hier serverseitig festgelegt; aus dem
// Client kommen NUR die fachlichen Felder (keine Rechte-Eskalation möglich).
export async function POST(req: NextRequest) {
  const parsed = registrierungSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  const email = data.email.toLowerCase()
  const payload = await payloadClient()

  // Doppelte E-Mail vorab abfangen (klare Meldung statt generischer 500).
  const vorhanden = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (vorhanden.docs.length > 0) {
    return NextResponse.json(
      { error: 'E-Mail bereits registriert', code: 'EMAIL_EXISTS' },
      { status: 409 },
    )
  }

  try {
    if (data.typ === 'dienst') {
      await payload.create({
        collection: 'users',
        data: {
          email,
          password: data.password,
          role: 'admin', // Dienst-Inhaber
          tenantId: tenantIdAus(data.dienstName), // neuer Mandant pro Dienst
          dienstName: data.dienstName,
          // Einzugsgebiet direkt setzen, falls bei der Registrierung erfasst.
          ...(data.einzugsGeo
            ? {
                einzugsGeo: data.einzugsGeo,
                einzugsRadiusKm: data.einzugsRadiusKm ?? 15,
              }
            : {}),
        },
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'users',
        data: {
          email,
          password: data.password,
          role: 'angehoeriger', // Suchende: kein Mandant, kein Klientendatenzugriff
          suchendeTyp: data.suchendeTyp,
        },
        overrideAccess: true,
      })
    }
  } catch {
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen' }, { status: 400 })
  }

  return NextResponse.json(
    { ok: true, role: data.typ === 'dienst' ? 'admin' : 'angehoeriger' },
    { status: 201 },
  )
}
