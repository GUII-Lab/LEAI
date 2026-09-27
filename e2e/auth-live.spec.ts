import { expect, test } from '@playwright/test'

const password = process.env.LEAI_AUTH_FIXTURE_PASSWORD
const backendPort = process.env.LEAI_AUTH_BACKEND_PORT

test('real isolated Django login, optional password update, and logout', async ({ page }, testInfo) => {
  test.skip(!password || !backendPort, 'Requires the isolated auth fixture and backend port')

  await page.route('http://127.0.0.1:8000/datapipeline/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    url.port = backendPort!
    const response = await route.fetch({ url: url.toString() })
    await route.fulfill({ response })
  })

  await page.goto('/FeedbackAnalyzer.html')
  await expect(page).toHaveURL(/InstructorLogin\.html\?next=/)
  await expect(page.getByRole('heading', { name: 'Instructor sign in' })).toBeVisible()
  await testInfo.attach('login', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  await page.getByRole('textbox', { name: 'Email' }).fill('auth-fixture@ucsc.edu')
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/FeedbackAnalyzer\.html$/)
  await expect(page.getByText('No active courses are available for this account.')).toBeVisible()
  await testInfo.attach('authenticated-analyzer', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  await page.goto('/InstructorPassword.html?next=%2FFeedbackAnalyzer.html')
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible()
  await page.getByLabel('Current password').fill(password!)
  await page.getByLabel('New password', { exact: true }).fill('New-For-Isolated-Auth-Test-2026!')
  await page.getByLabel('Confirm new password').fill('New-For-Isolated-Auth-Test-2026!')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page).toHaveURL(/FeedbackAnalyzer\.html/)
  await expect(page.getByText('No active courses are available for this account.')).toBeVisible()
  await testInfo.attach('authenticated-analyzer', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/InstructorLogin\.html\?next=/)
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('leai:local:instructor-token'))).toBeNull()

  await page.getByRole('textbox', { name: 'Email' }).fill('auth-fixture@ucsc.edu')
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('Sign-in failed')

  await page.getByLabel('Password').fill('New-For-Isolated-Auth-Test-2026!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/FeedbackAnalyzer\.html/)
  await expect(page.getByText('No active courses are available for this account.')).toBeVisible()
})
