import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'

// E2E-Tests fahren einen eigenen Dev-Server hoch und prüfen die vollständige
// Nutzerreise im Browser.
//
// Sie laufen gegen eine LOKALE WEGWERF-DATENBANK (.env.test), nicht gegen die
// Entwicklungs-/Produktivdatenbank aus .env. Grund: Die Tests schreiben Daten
// (nehmen Klienten in Touren auf) und setzen bei jedem Lauf das 2FA-Geheimnis
// des Testkontos zurück — beides darf eine Datenbank mit echten Mandanten
// niemals treffen.
//
// Vorbereitung:
//   pnpm run test:db:up      # lokale MongoDB (Replica-Set) starten
//   pnpm run test:db:reset   # Testdaten + Demo-Disponent anlegen
//   pnpm run test:e2e

// ── Sicherung ────────────────────────────────────────────────────────────
// Bevor irgendein Test startet: beweisen, dass die Testumgebung wirklich auf
// eine lokale Datenbank zeigt. Ein versehentliches `mongodb+srv://…` in
// .env.test würde die Suite sonst wieder auf ein echtes Cluster loslassen.
function pruefeTestDatenbank(): void {
  let inhalt: string
  try {
    inhalt = readFileSync('.env.test', 'utf8')
  } catch {
    throw new Error(
      '.env.test fehlt — die e2e-Tests brauchen eine eigene Testumgebung.\n' +
        'Siehe README, Abschnitt „Tests".',
    )
  }
  const uri = /^DATABASE_URI=(.*)$/m.exec(inhalt)?.[1]?.trim()
  if (!uri) throw new Error('.env.test enthält keine DATABASE_URI.')
  if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(uri)) {
    throw new Error(
      `ABBRUCH: DATABASE_URI in .env.test zeigt nicht auf eine lokale Datenbank.\n` +
        `Gefunden: ${uri.replace(/\/\/[^@]*@/, '//***@')}\n` +
        `E2E-Tests schreiben Daten und dürfen nur gegen eine Wegwerf-DB laufen.`,
    )
  }
}
pruefeTestDatenbank()

// Eigener Port, damit ein paralleler `pnpm dev` (der gegen .env läuft) nicht
// versehentlich als Testserver wiederverwendet wird.
const PORT = 3001

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  // list für die Konsole, html als hochladbares CI-Artefakt.
  reporter: [['list'], ['html', { open: 'never' }]],
  // Ein Worker: die Tests teilen sich den Demo-Disponenten; paralleles
  // Neu-Einrichten der 2FA würde die TOTP-Secrets überschreiben (Race).
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm run dev:test',
    url: `http://localhost:${PORT}/de`,
    // Bewusst KEIN reuseExistingServer: ein bereits laufender Server könnte
    // gegen .env (echte DB) gestartet worden sein. Lieber einen eigenen.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
