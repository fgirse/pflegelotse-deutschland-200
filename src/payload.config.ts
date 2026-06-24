import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { de } from '@payloadcms/translations/languages/de'
import { en } from '@payloadcms/translations/languages/en'

import { env } from '@/lib/env'
import { Users } from '@/collections/Users'
import { KlientenIdentitaet } from '@/collections/KlientenIdentitaet'
import { KlientenOperativ } from '@/collections/KlientenOperativ'
import { Touren } from '@/collections/Touren'
import { GdprAuditLog } from '@/collections/GdprAuditLog'
import { Bedarfe } from '@/collections/Bedarfe'
import { AngehoerigeIdentitaet } from '@/collections/AngehoerigeIdentitaet'
import { Angebote } from '@/collections/Angebote'
import { Zahlungen } from '@/collections/Zahlungen'
import { Abos } from '@/collections/Abos'
import { Praeventionsempfehlungen } from '@/collections/Praeventionsempfehlungen'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  // Admin-Oberfläche unter /admin (eigenes Payload-Styling).
  admin: { user: Users.slug, importMap: { baseDir: path.resolve(dirname) } },
  collections: [
    Users,
    KlientenIdentitaet,
    KlientenOperativ,
    Touren,
    GdprAuditLog,
    Bedarfe,
    AngehoerigeIdentitaet,
    Angebote,
    Zahlungen,
    Abos,
    Praeventionsempfehlungen,
  ],
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: mongooseAdapter({ url: env.DATABASE_URI }),
  // Admin-UI-Sprachen (Deutsch als Default).
  i18n: { supportedLanguages: { de, en }, fallbackLanguage: 'de' },
  // Inhaltslokalisierung der Daten bleibt diesem Bau vorbehalten; UI-i18n
  // läuft über next-intl im Frontend.
})
