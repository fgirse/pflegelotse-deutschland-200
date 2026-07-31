import { z } from 'zod'

// ── Pflegekraft anlegen (durch den Dienst-Admin) ──────────────────────────
// Die tenantId wird NIE vom Client übergeben — sie kommt serverseitig aus der
// Sitzung des Admins. So kann niemand eine Pflegekraft in einen fremden
// Mandanten legen (keine Rechte-Eskalation, konsistent zur Selbstregistrierung).

export const mitarbeiterAnlegenSchema = z.object({
  email: z.string().email('Bitte eine gültige E-Mail angeben'),
  // Initial-Passwort; die Pflegekraft meldet sich damit an und richtet beim
  // ersten Login die 2FA ein.
  password: z.string().min(8, 'Passwort: mindestens 8 Zeichen'),
  // Kürzel/ID, über das die Touren dieser Pflegekraft zugeordnet werden. Ohne
  // Kürzel sieht das Konto alle Touren des Dienstes (Disponenten-Fallback).
  pflegekraftId: z.string().trim().min(1).max(64).optional(),
})
export type MitarbeiterAnlegen = z.infer<typeof mitarbeiterAnlegenSchema>

// Schlanke Zeile für die Team-Liste (ohne Geheimnisse).
export interface MitarbeiterZeile {
  id: string
  email: string
  pflegekraftId?: string
  totpEnabled: boolean
  erstelltAm?: string
}
