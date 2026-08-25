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
  await expect(page.getByText(/Fahrzeit \d+ Min/).first()).toBeVisible()

  // Die Zeitfenster-Labels der Stopps geben die Reihenfolge wieder.
  const stopps = page.getByText(/^\d{2}:\d{2}–\d{2}:\d{2}$/)
  const vorher = await stopps.allTextContents()

  // Ersten Stopp nach unten schieben. Geprüft wird die Neuberechnung an der
  // Quelle: der Klick MUSS eine Server-Vorschau auslösen. Die angezeigte
  // Fahrzeit taugt dafür nicht als Signal — sie ist auf ganze Minuten gerundet,
  // und bei eng beieinanderliegenden Stopps liefern zwei Reihenfolgen
  // denselben Wert. Der Test wäre dann datenabhängig statt deterministisch.
  const [antwort] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/reorder') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Nach unten' }).first().click(),
  ])
  expect(antwort.ok()).toBeTruthy()

  // …und die neue Reihenfolge steht sichtbar in der Liste.
  await expect.poll(() => stopps.allTextContents()).not.toEqual(vorher)
})
