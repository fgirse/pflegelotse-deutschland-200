import { test, expect } from '@playwright/test'
import { loginAlsDisponent } from './auth'

// Die Dienst-Schritte (Eingänge) sind geschützt — vorab anmelden. Die
// Angehörigen-Schritte (Bedarf, Auswahl) funktionieren auch angemeldet.
test.beforeEach(async ({ page }) => {
  await loginAlsDisponent(page)
})

// Abnahmeszenario /F300/: Angehörige stellt Bedarf ein → Reverse Bidding →
// Auswahl eines Dienstes → Kontaktfreigabe (Anti-Leakage /F340/).
test('Reverse Bidding: Bedarf → Angebot → Auswahl → Kontaktfreigabe', async ({ page }) => {
  // Geocoding fest verdrahten: Der Test soll die Marktplatz-Kette prüfen, nicht
  // die Erreichbarkeit von Nominatim. Ein echter Aufruf wäre langsam und würde
  // am öffentlichen Rate-Limit gelegentlich scheitern.
  await page.route('**/api/v1/geo/geocode**', (route) =>
    route.fulfill({
      json: { lat: 47.995, lng: 7.85, displayName: 'Innenstadt, Freiburg im Breisgau' },
    }),
  )

  // 1) Bedarf einstellen — dreistufiges Formular.
  await page.goto('/de/markt')

  // Schritt 1: Angaben zur Person. Die Adresse muss bestätigt (geokodiert)
  // werden, sonst bleibt „Weiter" gesperrt.
  await page.getByLabel('Straße').fill('Kaiser-Joseph-Str.')
  await page.getByLabel('Hausnummer').fill('200')
  await page.getByLabel('PLZ').fill('79098')
  await page.getByLabel('Ort').fill('Freiburg im Breisgau')
  await page.getByRole('button', { name: 'Adresse prüfen' }).click()
  await expect(page.getByText(/✓ Innenstadt/)).toBeVisible()
  await page.getByLabel('Alter').fill('78')
  await page.getByLabel('Pflegegrad').selectOption('3')
  await page.getByLabel(/Zeitpunkt des Bedarfs/).fill('2026-09-01')
  await page.getByRole('button', { name: 'Weiter' }).click()

  // Schritt 2: Leistungswünsche — hier ohne Pflichtangaben.
  await page.getByRole('button', { name: 'Weiter' }).click()

  // Schritt 3: Kontaktdaten und Pflicht-Einwilligung (Art. 9 DSGVO).
  await page.getByLabel('vollständiger Name').fill('Petra Schneider')
  // Per Typ ansprechen: „E-Mail" ist auch der Name einer Kontaktart-Checkbox.
  await page.locator('input[type="email"]').fill('petra.schneider@example.org')
  await page.getByLabel('Telefonnummer').fill('0761-987654')
  await page.getByRole('checkbox', { name: 'Telefon', exact: true }).check()
  // Die Einwilligungs-Checkbox trägt kein eigenes Label — es ist die letzte.
  await page.getByRole('checkbox').last().check()
  await page.getByRole('button', { name: 'Formular abschicken' }).click()

  // Landung auf der Angebotsseite; Bedarfs-ID aus der URL ziehen.
  await page.waitForURL(/\/de\/markt\/[0-9a-f-]{36}$/)
  const bedarfId = page.url().split('/').pop()!
  expect(bedarfId).toMatch(/^[0-9a-f-]{36}$/)

  // 2) Als Dienst ein Angebot auf genau diesen Bedarf abgeben.
  await page.goto('/de/eingaenge')
  const zeile = page.locator(`li[data-bedarf="${bedarfId}"]`)
  await expect(zeile).toBeVisible()
  await zeile.getByPlaceholder('Nachricht an Angehörige').fill('Vormittags frei.')
  await zeile.getByRole('button', { name: 'Angebot abgeben' }).click()
  await expect(zeile.getByText('Angebot gesendet')).toBeVisible()

  // 3) Zurück als Angehörige: Angebot sehen und Dienst wählen.
  await page.goto(`/de/markt/${bedarfId}`)
  const waehlen = page.getByRole('button', { name: 'Diesen Dienst wählen' })
  await expect(waehlen).toBeVisible()
  await waehlen.click()
  await expect(page.getByText(/Du hast einen Dienst gewählt/)).toBeVisible()

  // 4) Als Dienst den freigegebenen Kontakt abrufen (Anti-Leakage erfüllt).
  await page.goto('/de/eingaenge')
  const gewonnen = page.locator(`li[data-bedarf="${bedarfId}"]`)
  await expect(gewonnen).toBeVisible()
  await gewonnen.getByRole('button', { name: 'Freigegebenen Kontakt anzeigen' }).click()
  await expect(gewonnen.getByText(/0761-987654/)).toBeVisible()
})
