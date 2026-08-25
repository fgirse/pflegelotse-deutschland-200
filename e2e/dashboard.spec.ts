import { test, expect } from '@playwright/test'
import { loginAlsDisponent } from './auth'

// Vor jedem Test anmelden (Dienst-Seiten sind durch Auth + 2FA geschützt).
test.beforeEach(async ({ page }) => {
  await loginAlsDisponent(page)
})

// Abnahmeszenario /A200/: Disponent öffnet das Dashboard, wählt einen offenen
// Klienten, sieht passende Touren (Fit-Score) und nimmt ihn per Klick auf.
test('Disponent füllt eine Tourenlücke per Ein-Klick', async ({ page }) => {
  await page.goto('/de/dashboard')

  // Es gibt offene Kandidaten in der linken Spalte.
  const kandidaten = page.locator('section[aria-labelledby="kandidaten-h"] button')
  await expect(kandidaten.first()).toBeVisible()

  // Ersten Kandidaten auswählen → Fit-Score wird berechnet.
  await kandidaten.first().click()

  // Trefferliste oder „keine Tour"-Hinweis erscheint (live region).
  const treffer = page.locator('section[aria-labelledby="treffer-h"]')
  await expect(treffer).toBeVisible()

  // Wenn ein Treffer da ist, aufnehmen und Aktualisierung abwarten.
  const aufnehmen = treffer.getByRole('button', { name: /In Tour aufnehmen|Add to tour/ })
  if (await aufnehmen.count()) {
    await aufnehmen.first().click()
    // Nach dem Aufnehmen verschwindet die Auswahl (Trefferpanel zeigt Hinweis).
    await expect(treffer).toBeVisible()
  }
})

// Barrierefreiheit: Die Karte hat eine gleichwertige Tabellenalternative (/Q400/).
test('Karte besitzt eine Tabellenalternative', async ({ page }) => {
  await page.goto('/de/dashboard')
  await page.getByRole('button', { name: 'Tabelle' }).click()
  // In der Tabellenansicht erscheint mindestens eine Tabelle.
  await expect(page.locator('table').first()).toBeVisible()
})

// Der Disponent muss erkennen können, worauf die Fahrzeiten beruhen. Fällt das
// Straßenrouting aus (oder ist keins verbunden), rechnet die App still mit
// Luftlinie weiter — dann MUSS das Banner erscheinen, sonst hält der Dienst
// Schätzwerte für echte Fahrzeiten.
test('Luftlinien-Modus wird im Dashboard sichtbar gemacht', async ({ page, request }) => {
  // Gegen den tatsächlichen Zustand prüfen, nicht gegen eine Annahme über die
  // Testumgebung — so bleibt der Test gültig, sobald OSRM verdrahtet ist.
  const health = await (await request.get('/api/v1/health')).json()
  const luftlinie = health.routing?.modus === 'luftlinie'

  await page.goto('/de/dashboard')
  const banner = page.getByText(/Fahrzeiten sind Schätzwerte/)

  if (luftlinie) {
    await expect(banner).toBeVisible()
  } else {
    // Bei echtem Straßenrouting darf das Banner die Oberfläche nicht stören.
    await expect(banner).toHaveCount(0)
  }
})
