import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  const api = '**/datapipeline/api/v1/'
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
  await page.route(`${api}environment/`, (route) => route.fulfill({
    headers,
    json: {
      environment: 'local', backend_build_sha: 'local-backend', schema_identity: 'public',
      contract_version: '2026-09-21', allowed_app_bases: ['/'], server_time: '2026-09-24T12:00:00Z',
    },
  }))
  await page.route(`${api}instructor_me/`, (route) => route.fulfill({
    headers,
    json: {
      id: '550e8400-e29b-41d4-a716-446655440001', email: 'teacher@ucsc.edu',
      display_name: 'Teacher', platform_role: 'member', must_change_password: false,
      institutions: [],
    },
  }))
  await page.route(`${api}instructor_courses/`, (route) => route.fulfill({ headers, json: { courses: [] } }))
  await page.addInitScript(() => sessionStorage.setItem('leai:local:instructor-token', 'test-session-token'))
})

for (const width of [390, 820, 1022, 1440]) {
  test(`keeps the LEAI shell within the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible()
    if (width < 1024) {
      await page.getByRole('button', { name: 'Open navigation' }).click()
      await expect(page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Prompt Designer' })).toBeVisible()
    } else {
      await expect(page.getByRole('link', { name: 'Prompt Designer' })).toBeVisible()
    }
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

test('loads the shared design system on multipage instructor entries', async ({ page }) => {
  await page.goto('/FeedbackAnalyzer.html')
  await expect(page.getByRole('heading', { name: 'Feedback Analyzer' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe('rgb(248, 250, 251)')
})

for (const [path, title] of [
  ['/InstructorHome.html', 'Your courses'],
  ['/PromptDesigner.html', 'Prompt Designer'],
  ['/FeedbackAnalyzer.html', 'Feedback Analyzer'],
  ['/FeedbackChat.html', 'Feedback Chat'],
  ['/CourseBanner.html', 'Course Banner'],
  ['/Customizations.html', 'Customizations'],
  ['/feedback.html', 'Reflection'],
]) {
  test(`mounts ${path} without a rewrite`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })
}
