import type { Access } from 'payload'

// Rollen laut Pflichtenheft (Abschnitt 3.2).
export type Rolle =
  | 'disponent'
  | 'pflegekraft'
  | 'angehoeriger'
  | 'admin'
  | 'plattform_admin'

interface AppUser {
  role?: Rolle
  tenantId?: string
}

// Mandantentrennung: Jeder Zugriff ist auf den tenant_id des Nutzers
// beschränkt. Der Betreiber (plattform_admin) ist bewusst NICHT global
// lesefähig auf Klientendaten — er betreibt die Plattform ohne Routine-PII-Zugriff.
export const tenantScoped: Access = ({ req: { user } }) => {
  const u = user as AppUser | null
  if (!u) return false
  if (u.role === 'plattform_admin') return true // nur Betriebsdaten, keine PII-Collections
  if (!u.tenantId) return false
  return { tenantId: { equals: u.tenantId } }
}

// Nur eingeloggte Mitarbeiter eines Dienstes (kein Angehöriger).
export const istDienstMitarbeiter: Access = ({ req: { user } }) => {
  const u = user as AppUser | null
  if (!u) return false
  return ['disponent', 'pflegekraft', 'admin', 'plattform_admin'].includes(u.role ?? '')
}

// Schreibrecht auf Klientendaten: Disponent/Admin innerhalb des Mandanten.
export const klientenSchreibAccess: Access = ({ req: { user } }) => {
  const u = user as AppUser | null
  if (!u || !u.tenantId) return false
  if (!['disponent', 'admin'].includes(u.role ?? '')) return false
  return { tenantId: { equals: u.tenantId } }
}
