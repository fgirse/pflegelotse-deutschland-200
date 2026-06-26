import { z } from 'zod'

// ── Selbstregistrierung (zod) ────────────────────────────────────────────
// Zwei Zielgruppen: Pflegedienstsuchende (Angehörige/Patient/Sozialdienst) und
// ambulante Pflegedienste. Rolle und Mandant (tenantId) werden ausschließlich
// SERVERSEITIG gesetzt — der Client darf sie nie bestimmen (Rechte-Eskalation).

export const suchendeTypSchema = z.enum(['angehoerige', 'patient', 'sozialdienst'])
export type SuchendeTyp = z.infer<typeof suchendeTypSchema>

const email = z.string().email('Bitte eine gültige E-Mail angeben')
const password = z.string().min(8, 'Passwort: mindestens 8 Zeichen')

export const registrierungSchema = z.discriminatedUnion('typ', [
  // Pflegedienstsuchende: kein Mandant, Rolle wird serverseitig 'angehoeriger'.
  z.object({
    typ: z.literal('suchende'),
    email,
    password,
    suchendeTyp: suchendeTypSchema,
    einwilligung: z.literal(true),
  }),
  // Pflegedienst: bekommt serverseitig einen neuen Mandanten + Rolle 'admin'.
  // Einzugsgebiet (Mittelpunkt + Radius) wird gleich erfasst, damit der Dienst
  // sofort passende Bedarfe sieht.
  z.object({
    typ: z.literal('dienst'),
    email,
    password,
    dienstName: z.string().min(2, 'Name des Pflegedienstes fehlt'),
    ort: z.string().optional(),
    einzugsGeo: z.object({ lat: z.number(), lng: z.number() }).optional(),
    einzugsRadiusKm: z.number().min(1).max(100).optional(),
    einwilligung: z.literal(true),
  }),
])
export type RegistrierungEingabe = z.infer<typeof registrierungSchema>
