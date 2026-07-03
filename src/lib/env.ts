import { z } from 'zod'

// Zentrale, zod-validierte Env-Variablen. Fehlt etwas Kritisches,
// scheitert der Start sofort mit klarer Meldung statt später diffus.
const schema = z.object({
  DATABASE_URI: z.string().min(1, 'DATABASE_URI fehlt'),
  PAYLOAD_SECRET: z.string().min(1, 'PAYLOAD_SECRET fehlt'),
  // Master-Key für den lokalen Encryption-Port (Base64, 32 Byte).
  ENCRYPTION_MASTER_KEY: z.string().min(1, 'ENCRYPTION_MASTER_KEY fehlt'),
  AUDIT_PEPPER: z.string().min(1, 'AUDIT_PEPPER fehlt'),
  AUDIT_PEPPER_VERSION: z.string().default('2026-v1'),
  NEXT_PUBLIC_SERVER_URL: z.string().default('http://localhost:3000'),
  // Routing: 'haversine' (Heuristik, keine Infra), 'osrm' (eigenes Straßen-
  // routing) oder 'here' (verkehrsbewusstes Routing über HERE Matrix v8,
  // EU-Anbieter). Bei 'osrm'/'here' muss die jeweilige Konfiguration gesetzt
  // sein; fällt bei Ausfall automatisch auf Haversine zurück.
  ROUTING_PROVIDER: z.enum(['haversine', 'osrm', 'here']).default('haversine'),
  OSRM_BASE_URL: z.string().optional(), // z. B. https://router.project-osrm.org
  OSRM_PROFILE: z.string().default('driving'),
  // Optionaler API-Key für den eigenen, abgesicherten OSRM-Server (wird als
  // X-Api-Key-Header gesendet; vom Reverse-Proxy geprüft).
  OSRM_API_KEY: z.string().optional(),
  // API-Key für HERE (nur bei ROUTING_PROVIDER=here). Verkehrsbewusste
  // Fahrzeit-Matrix; ohne Key wird auf Haversine zurückgefallen.
  HERE_API_KEY: z.string().optional(),
  // Geocoding (Adresse → Koordinaten) über Nominatim/OpenStreetMap.
  // Für Produktion idealerweise eigene Instanz; User-Agent mit Kontakt (Policy).
  NOMINATIM_BASE_URL: z.string().default('https://nominatim.openstreetmap.org'),
  GEOCODER_USER_AGENT: z
    .string()
    .default('PflegeLotse/1.0 (+https://pflegelotse-deutschland-200.vercel.app)'),
  // SLA / Benachrichtigungen (optional).
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Pflegelotse <info@example.de>'),
  NOTIFY_ENABLED: z.string().optional(), // "true" aktiviert echten Versand
  CRON_SECRET: z.string().optional(),
  // Payment (Mollie).
  MOLLIE_API_KEY: z.string().optional(),
  // KI-Pflegelotse (Anthropic Claude, serverseitig).
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-4-8'),
  // CSFLE / KMS. CSFLE_ENABLED=true schaltet echte Feldverschlüsselung an.
  CSFLE_ENABLED: z.string().optional(),
  CSFLE_KMS_PROVIDER: z.enum(['local', 'aws']).optional(),
  CSFLE_LOCAL_MASTER_KEY: z.string().optional(), // 96 Byte, Base64 (Dev)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  CSFLE_AWS_KEY_REGION: z.string().optional(),
  CSFLE_AWS_KEY_ARN: z.string().optional(),
})

// In der Build-Phase von Next.js sind nicht immer alle Secrets gesetzt;
// dort lassen wir Platzhalter zu, damit `next build` nicht scheitert.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

function load() {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    if (isBuildPhase) {
      // Während des Builds tolerieren wir fehlende Werte.
      return schema.parse({
        DATABASE_URI: process.env.DATABASE_URI ?? 'mongodb://placeholder',
        PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? 'placeholder',
        ENCRYPTION_MASTER_KEY:
          process.env.ENCRYPTION_MASTER_KEY ?? Buffer.alloc(32).toString('base64'),
        AUDIT_PEPPER: process.env.AUDIT_PEPPER ?? 'placeholder',
        AUDIT_PEPPER_VERSION: process.env.AUDIT_PEPPER_VERSION,
        NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
      })
    }
    const msg = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Ungültige Umgebungskonfiguration:\n${msg}`)
  }
  return parsed.data
}

export const env = load()
