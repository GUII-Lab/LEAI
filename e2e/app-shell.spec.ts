import { expect, test } from '@playwright/test'

test('loads the LEAI shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'LEAI' })).toBeVisible()
})
