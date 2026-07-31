import { z } from 'zod'

// ── Passwortwechsel (zod) ─────────────────────────────────────────────────
// Genutzt vom Self-Service (/konto) und vom erzwungenen Wechsel nach dem
// Initial-Login. Das aktuelle Passwort wird immer geprüft (Defense in Depth:
// eine gekaperte Sitzung allein reicht nicht zum Ändern).

export const passwortAendernSchema = z
  .object({
    aktuellesPasswort: z.string().min(1, 'Aktuelles Passwort fehlt'),
    neuesPasswort: z.string().min(8, 'Neues Passwort: mindestens 8 Zeichen'),
  })
  .refine((d) => d.neuesPasswort !== d.aktuellesPasswort, {
    message: 'Neues Passwort muss sich vom aktuellen unterscheiden',
    path: ['neuesPasswort'],
  })
export type PasswortAendern = z.infer<typeof passwortAendernSchema>
