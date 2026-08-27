import { payloadClient } from '@/server/payloadClient'
import {
  bewerteKrypto,
  CACHE_FEHLER_MS,
  CACHE_OK_MS,
  MELDE_FENSTER_MS,
  type KryptoStatus,
} from './kryptoStatus'

// Führt den Verschlüsselungs-Selbsttest gegen die Datenbank aus. Die
// Bewertungslogik liegt in kryptoStatus.ts (rein und testbar); hier steckt nur
// der Lesevorgang, der Cache und die Monitoring-Meldung.

let cache: { status: KryptoStatus; bis: number } | null = null
let zuletztGemeldet: number | null = null

// Nur für Tests.
export function resetKryptoCache(): void {
  cache = null
  zuletztGemeldet = null
}

// Meldet einen Schlüsselfehler ans Monitoring — entprellt, damit ein
// dauerhafter Fehlstand nicht bei jedem Health-Abruf ein Event erzeugt.
// Sentry wird lazy geladen; ohne DSN ist alles ein No-Op.
function melde(): void {
  // Ursache offen lassen: Es kann der falsche ENCRYPTION_MASTER_KEY sein, oder
  // ein CSFLE_ENABLED, das nicht zu dem Verfahren passt, mit dem die Daten
  // geschrieben wurden. Beides sieht von hier gleich aus.
  const text =
    '[krypto] Säule-1-Daten nicht entschlüsselbar — ENCRYPTION_MASTER_KEY oder CSFLE_ENABLED passt nicht zu den gespeicherten Daten'
  console.warn(text)
  const jetzt = Date.now()
  if (zuletztGemeldet != null && jetzt - zuletztGemeldet < MELDE_FENSTER_MS) return
  zuletztGemeldet = jetzt
  void import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.captureMessage(text, { level: 'error', tags: { bereich: 'krypto' } })
    })
    .catch(() => {
      // Sentry nicht verfügbar (z. B. im Test) — das Log oben genügt.
    })
}

// Ermittelt den Verschlüsselungsstatus — gecacht, damit der öffentliche
// Health-Endpoint nicht bei jedem Abruf eine Lese- und Entschlüsselungsrunde
// auslöst (das wäre sonst ein billiger Weg, Last zu erzeugen).
//
// VORAUSSETZUNG: Die Datenbank muss erreichbar sein. Ein Verbindungsfehler
// wäre hier von einem Entschlüsselungsfehler nicht sauber zu unterscheiden und
// würde fälschlich als Schlüsselproblem gemeldet. Der Aufrufer prüft deshalb
// zuerst die DB (siehe /api/v1/health) und ruft diese Funktion nur dann auf.
export async function pruefeKrypto(): Promise<KryptoStatus> {
  const jetzt = Date.now()
  if (cache && jetzt < cache.bis) return cache.status

  let status: KryptoStatus
  try {
    const payload = await payloadClient()
    // depth 0 + limit 1: eine Identität genügt als Probe.
    const res = await payload.find({
      collection: 'klienten_identitaet',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = res.docs[0] as { vorname?: unknown } | undefined
    status = bewerteKrypto({ gefunden: Boolean(doc), probewert: doc?.vorname })
  } catch {
    // Wirft der afterRead-Hook, passt der Schlüssel nicht zu den Daten.
    status = bewerteKrypto({ gefunden: true, fehlgeschlagen: true })
  }

  cache = { status, bis: jetzt + (status.modus === 'ok' ? CACHE_OK_MS : CACHE_FEHLER_MS) }
  if (status.modus === 'schluesselFehler') melde()
  return status
}
