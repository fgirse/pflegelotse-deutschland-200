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
  // 1) Bedarf einstellen (zweistufiges Formular).
  await page.goto('/de/markt')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByLabel('Vorname').fill('Petra')
  await page.getByLabel('Nachname').fill('Schneider')
  await page.getByLabel('Telefon').fill('0761-987654')
  // Pflicht-Einwilligung (Art. 9 DSGVO) — sonst ist „Bedarf einstellen" gesperrt.
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Bedarf einstellen' }).click()

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
