import { defineConfig, devices } from '@playwright/test'

// E2E-Tests fahren den Dev-Server hoch und prüfen die vollständige
// Nutzerreise im Browser. Setzt eine laufende, geseedete DB voraus
// (pnpm run db:up && pnpm run db:init && pnpm run db:seed).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  // Ein Worker: die Tests teilen sich den Demo-Disponenten; paralleles
  // Neu-Einrichten der 2FA würde die TOTP-Secrets überschreiben (Race).
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000/de',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
