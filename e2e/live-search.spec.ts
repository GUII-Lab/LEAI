import { expect, test } from '@playwright/test'

const demoEmail = process.env.LEAI_LIVE_SEARCH_EMAIL
const demoPassword = process.env.LEAI_LIVE_SEARCH_PASSWORD

test('real local instructor sign-in and completed-response search', async ({ page }, testInfo) => {
  test.skip(!demoEmail || !demoPassword, 'Requires the isolated local search fixture')

  const searchUrls: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/responses/search/')) searchUrls.push(request.url())
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://127.0.0.1:5173/FeedbackAnalyzer.html')
  await expect(page).toHaveURL(/InstructorLogin\.html\?next=/)
  await page.getByRole('textbox', { name: 'Email' }).fill(demoEmail!)
  await page.getByRole('textbox', { name: 'Password' }).fill(demoPassword!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Feedback Analyzer' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Course' })).toContainText('Search Demo Course')
  await page.getByRole('searchbox', { name: 'Search student responses' }).fill('capstone')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByText('1 matching response')).toBeVisible()
  await expect(page.getByText(/My capstone prototype helped me/)).toBeVisible()
  await expect(page.getByText(/unfinished private draft/)).toHaveCount(0)
  await expect(page.getByText(/other-course private text/)).toHaveCount(0)
  expect(searchUrls).toHaveLength(1)
  expect(searchUrls[0]).not.toContain('capstone')

  await testInfo.attach('desktop-search', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  })
  for (const width of [1022, 820, 390]) {
    await page.setViewportSize({ width, height: 820 })
    await expect(page.getByText(/My capstone prototype helped me/)).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await testInfo.attach('mobile-search', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  })
})
