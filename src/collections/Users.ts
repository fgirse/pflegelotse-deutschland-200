import type { CollectionConfig, FieldHook } from 'payload'
import { sealSecret, openSecret } from '@/lib/encryption'

// TOTP-Seed verschlüsselt ablegen (Master-Key). Niemals an Clients ausliefern.
const sealHook: FieldHook = ({ value }) =>
  value && !String(value).includes(':') ? sealSecret(String(value)) : value
const openHook: FieldHook = ({ value }) => {
  if (!value) return value
  try {
    return openSecret(String(value))
  } catch {
    return value
  }
}

// Auth- und RBAC-Collection. Rollen und Mandantenzuordnung steuern den
// Zugriff auf alle übrigen Collections. TOTP-2FA (Pflichtenheft /Q110/) wird
// in einem späteren Bau ergänzt.
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'role', 'tenantId'] },
  access: {
    // Nutzerverwaltung nur für Inhaber/Betreiber.
    read: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'disponent',
      options: [
        { label: 'Disponent/PDL', value: 'disponent' },
        { label: 'Pflegekraft', value: 'pflegekraft' },
        { label: 'Angehörige(r)', value: 'angehoeriger' },
        { label: 'Dienst-Inhaber', value: 'admin' },
        { label: 'Betreiber', value: 'plattform_admin' },
      ],
    },
    {
      name: 'tenantId',
      type: 'text',
      label: 'Mandant (tenant_id)',
      // Betreiber sind mandantenübergreifend; alle anderen brauchen einen Mandanten.
      required: false,
      index: true,
    },
    // TOTP-2FA: Seed verschlüsselt, nie an Clients ausgeliefert.
    {
      name: 'totpSecret',
      type: 'text',
      access: { read: () => false },
      admin: { hidden: true },
      hooks: { beforeChange: [sealHook], afterRead: [openHook] },
    },
    { name: 'totpEnabled', type: 'checkbox', defaultValue: false },
  ],
}
