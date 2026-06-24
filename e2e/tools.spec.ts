import { test, expect } from '@playwright/test'

// Öffentliches, rein clientseitiges Tool (/F700/) — keine Anmeldung nötig.
test('Pflegegrad-Rechner berechnet live ohne Anmeldung', async ({ page }) => {
  await page.goto('/de/tools/pflegegrad')

  // Ohne Eingabe: kein Pflegegrad.
  await expect(page.getByText('Kein Pflegegrad')).toBeVisible()

  // Alle Module auf die schwerste Stufe (Wert 4) → Pflegegrad 5.
  const selects = page.locator('fieldset select')
  const anzahl = await selects.count()
  for (let i = 0; i < anzahl; i++) {
    await selects.nth(i).selectOption('4')
  }
  await expect(page.getByText(/Pflegegrad 5/)).toBeVisible()
  await expect(page.getByText(/100 \/ 100/)).toBeVisible()
})
