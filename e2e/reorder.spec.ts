import { test, expect } from '@playwright/test'
import { loginAlsDisponent } from './auth'

// Vor jedem Test anmelden (Dienst-Seiten sind durch Auth + 2FA geschützt).
test.beforeEach(async ({ page }) => {
  await loginAlsDisponent(page)
})

// Abnahme 2.5 (§5.2.3): Disponent passt die Stopp-Reihenfolge einer Tour an;
// die Kennzahl-Anzeige (Fahrzeit) aktualisiert sich sofort. Das „per Ziehen"
// wird über die tastaturbedienbare Alternative (Hoch/Runter) ausgelöst — sie
// nutzt denselben Live-Vorschau-Pfad wie Drag&Drop. Die rote Zeitfenster-
// Markierung ist zusätzlich deterministisch in tourPlan.test.ts abgedeckt.
test('Reihenfolge anpassen aktualisiert die Kennzahlen sofort', async ({ page }) => {
  await page.goto('/de/dashboard')

  // Eine Tour mit mehreren Einsätzen bietet den „Reihenfolge"-Button.
  const reihenfolgeBtn = page.getByRole('button', { name: 'Reihenfolge', exact: true }).first()
  await expect(reihenfolgeBtn).toBeVisible()
  await reihenfolgeBtn.click()

  // Das Umsortier-Panel erscheint mit der Fahrzeit-Kennzahl (Live-Vorschau).
  await expect(page.getByText('Reihenfolge per Ziehen anpassen')).toBeVisible()
  const kennzahl = page.getByText(/Fahrzeit \d+ Min/).first()
  await expect(kennzahl).toBeVisible()
  const vorher = (await kennzahl.textContent()) ?? ''

  // Ersten Stopp nach unten schieben → Server-Vorschau → Kennzahl ändert sich.
  await page.getByRole('button', { name: 'Nach unten' }).first().click()
  await expect(kennzahl).not.toHaveText(vorher)
})
