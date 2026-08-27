import { test, expect } from '@playwright/test'
import { loginAlsDisponent } from './auth'

test.beforeEach(async ({ page }) => {
  await loginAlsDisponent(page)
})

// Die Adresse eines Klienten wird in vier Feldern erfasst. Ohne PLZ und Ort
// ist die Geokodierung vieldeutig — sie träfe im Zweifel still den falschen
// Ort und der Klient läge Kilometer neben seiner echten Adresse. Deshalb ist
// „Suchen" erst freigegeben, wenn die Adresse vollständig ist.
test('Klienten-Anlage verlangt eine vollständige Adresse vor der Geo-Suche', async ({ page }) => {
  await page.goto('/de/dienst/klienten')

  await page.getByRole('button', { name: /Neuen Klienten|Neu anlegen|\+ / }).first().click()

  const suchen = page.getByRole('button', { name: 'Suchen' })
  await expect(suchen).toBeVisible()
  // Noch nichts eingegeben → gesperrt.
  await expect(suchen).toBeDisabled()

  await page.getByLabel('Straße', { exact: true }).fill('Kaiser-Joseph-Str.')
  await page.getByLabel('Hausnummer', { exact: true }).fill('200')
  await expect(suchen, 'ohne PLZ und Ort bleibt die Suche gesperrt').toBeDisabled()

  // Eine unvollständige PLZ würde den falschen Ort treffen.
  await page.getByLabel('PLZ', { exact: true }).fill('790')
  await page.getByLabel('Ort', { exact: true }).fill('Freiburg im Breisgau')
  await expect(suchen, 'vierstellige PLZ reicht nicht').toBeDisabled()

  await page.getByLabel('PLZ', { exact: true }).fill('79098')
  await expect(suchen, 'vollständige Adresse gibt die Suche frei').toBeEnabled()
})

// Bestandsdaten wurden als Freitext erfasst, oft ohne PLZ. Beim Bearbeiten
// müssen sie sichtbar in den Einzelfeldern landen, statt verloren zu gehen.
test('Bearbeiten zerlegt eine gespeicherte Adresse in die Einzelfelder', async ({ page }) => {
  await page.goto('/de/dienst/klienten')

  const zeile = page.locator('tbody tr').first()
  await expect(zeile).toBeVisible()
  await zeile.getByRole('button', { name: /Bearbeiten/ }).click()

  // Der Seed legt Adressen der Form „Habsburgerstr. 1, Freiburg" an: Straße und
  // Hausnummer getrennt, Ort gefüllt, PLZ leer (war nie erfasst).
  await expect(page.getByLabel('Straße', { exact: true })).not.toHaveValue('')
  await expect(page.getByLabel('Hausnummer', { exact: true })).not.toHaveValue('')
  await expect(page.getByLabel('Ort', { exact: true })).not.toHaveValue('')
})
