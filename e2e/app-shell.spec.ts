import { expect, test } from '@playwright/test'

for (const width of [390, 820, 1022, 1440]) {
  test(`keeps the LEAI shell within the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'LEAI' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Prompt Designer' })).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)
  })
}

test('opens and closes the mobile navigation with real keyboard focus return', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/')

  const trigger = page.getByRole('button', { name: 'Open navigation' })
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden()
  await expect(trigger).toBeFocused()
})

for (const [path, title] of [
  ['/InstructorHome.html', 'LEAI'],
  ['/PromptDesigner.html', 'Prompt Designer'],
  ['/FeedbackAnalyzer.html', 'Feedback Analyzer'],
  ['/FeedbackChat.html', 'Feedback Chat'],
  ['/CourseBanner.html', 'Course Banner'],
  ['/Customizations.html', 'Customizations'],
  ['/feedback.html', 'Feedback'],
]) {
  test(`mounts ${path} without a rewrite`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })
}
