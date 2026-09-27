import { expect, test } from '@playwright/test'

const password = process.env.LEAI_HOME_FIXTURE_PASSWORD
const emailTemplate = process.env.LEAI_HOME_FIXTURE_EMAIL
const runId = process.env.LEAI_HOME_RUN_ID ?? 'manual'

test('real isolated Instructor Home course and account flow', async ({ page }, testInfo) => {
  test.skip(!password || !emailTemplate?.includes('{browser}'), 'Requires an isolated email fixture per browser')
  const email = emailTemplate!.replace('{browser}', testInfo.project.name)
  const courseName = `Home Verification ${runId} ${testInfo.project.name}`
  const courseCode = `home-${runId}-${testInfo.project.name}`

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/InstructorHome.html')
  await expect(page).toHaveURL(/InstructorLogin\.html\?next=/)
  await testInfo.attach('login', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/InstructorHome\.html$/)
  await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create course' })).toBeVisible()
  await testInfo.attach('before-creation-home', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Create course' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create a course' })
  await expect(dialog.getByRole('combobox', { name: 'Institution' })).toHaveValue('verify')
  await dialog.getByRole('textbox', { name: 'Course name' }).fill(courseName)
  await dialog.getByRole('textbox', { name: 'Course code' }).fill(courseCode)
  await dialog.getByRole('button', { name: 'Create course' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('article', { name: courseName })).toBeVisible()
  await expect(page.getByRole('article', { name: courseName }).getByText('Current')).toBeVisible()
  await expect(page.getByText('Course created. Open feedback to continue.')).toBeVisible()
  await testInfo.attach('created-home', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  const selected = await page.evaluate(() => sessionStorage.getItem('leai:local:selected-course'))
  expect(selected).toMatch(/^[0-9a-f-]{36}$/)
  await page.reload()
  await expect(page.getByRole('article', { name: courseName })).toBeVisible()
  await testInfo.attach('reloaded-home', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  for (const width of [390, 820, 1022, 1440]) {
    await page.setViewportSize({ width, height: 820 })
    await expect(page.getByRole('article', { name: courseName })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await testInfo.attach(`home-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Account' }).click()
  await expect(page).toHaveURL(/InstructorHome\.html\?view=account$/)
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveAttribute('readonly')
  const updated = `Home Verification ${testInfo.project.name}`
  await page.getByRole('textbox', { name: 'Display name' }).fill(updated)
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByText('Profile saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Display name' })).toHaveValue(updated)
  await testInfo.attach('account', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  await page.getByRole('link', { name: 'Change password' }).click()
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible()
  await testInfo.attach('password', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/InstructorLogin\.html\?next=/)
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('leai:local:selected-course'))).toBeNull()
  await testInfo.attach('signed-out', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})
