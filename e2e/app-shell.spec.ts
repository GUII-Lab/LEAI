import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

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
  await page.route(`${api}instructor_courses/`, (route) => route.fulfill({ headers, json: { courses: [{
    course_id: '11111111-1111-4111-8111-111111111111',
    course_code: 'cmpm-80h', course_name: 'Game Design', institution_slug: 'ucsc',
    lifecycle_state: 'active', role: 'owner', allowed_actions: ['course.manage', 'feedback.author'],
  }] } }))
  await page.addInitScript(() => {
    sessionStorage.setItem('leai:local:instructor-token', 'test-session-token')
    if (!sessionStorage.getItem('leai:test-course-context-initialized')) {
      sessionStorage.setItem('leai:local:selected-course', '11111111-1111-4111-8111-111111111111')
      sessionStorage.setItem('leai:test-course-context-initialized', 'true')
    }
  })
})

for (const width of [390, 820, 1022, 1440]) {
  test(`keeps the LEAI shell within the viewport at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible()
    if (width < 1024) {
      await page.getByRole('button', { name: 'Open navigation' }).click()
      const navigation = page.getByRole('dialog', { name: 'Navigation' })
      await expect(navigation.getByRole('navigation', { name: 'Account navigation' })).toBeVisible()
      await expect(navigation.getByRole('navigation', { name: 'Course navigation' })).toHaveCount(0)
      await expect(navigation.getByRole('button', { name: 'Sign out' })).toBeVisible()
      if (width === 390) {
        await page.waitForTimeout(250)
        const screenshotDirectory = join(process.cwd(), '.web-verify', 'screenshots')
        await mkdir(screenshotDirectory, { recursive: true })
        await page.screenshot({
          path: join(screenshotDirectory, `mobile-sidebar-account-${testInfo.project.name}.png`),
          fullPage: true,
        })
      }
    } else {
      await expect(page.getByRole('navigation', { name: 'Account navigation' })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Course navigation' })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Account' }).locator('span')).toBeVisible()
      await expect(page.getByRole('link', { name: 'All Courses' }).locator('span')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign out' }).locator('span')).toBeVisible()
      const labels = [
        { element: page.getByRole('link', { name: 'Account' }).locator('span'), maxHeight: 20 },
        { element: page.getByRole('link', { name: 'All Courses' }).locator('span'), maxHeight: 40 },
        { element: page.getByRole('button', { name: 'Sign out' }).locator('span'), maxHeight: 20 },
      ]
      for (const { element, maxHeight } of labels) {
        await expect.poll(() => element.evaluate(node => getComputedStyle(node).fontSize))
          .toBe('16px')
        await expect.poll(() => element.evaluate(node => node.getBoundingClientRect().height))
          .toBeLessThanOrEqual(maxHeight)
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight))
        .toBe(true)
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)
  })
}

test('entering a course opens its workspace navigation', async ({ page }, testInfo) => {
  await page.route('**/datapipeline/api/v1/instructor_courses/', (route) => route.fulfill({
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    json: { courses: [{
      course_id: '11111111-1111-4111-8111-111111111111',
      course_code: 'cmpm-80h', course_name: 'Game Design', institution_slug: 'ucsc',
      lifecycle_state: 'active', role: 'owner', allowed_actions: ['course.manage', 'feedback.author'],
    }] },
  }))
  await page.setViewportSize({ width: 1440, height: 900 })
  const screenshotDirectory = join(process.cwd(), '.web-verify', 'screenshots')
  await mkdir(screenshotDirectory, { recursive: true })
  await page.goto('/InstructorHome.html')

  const card = page.getByRole('article', { name: 'Game Design' })
  await expect(card).toBeVisible()
  await expect.poll(() => card.locator('p').evaluate(element => getComputedStyle(element).fontSize))
    .toBe('12px')
  await expect(page.getByRole('navigation', { name: 'Course navigation' })).toHaveCount(0)
  const desktopSignOut = page.getByRole('button', { name: 'Sign out' })
  const desktopSignOutBox = await desktopSignOut.boundingBox()
  expect(desktopSignOutBox).not.toBeNull()
  expect(desktopSignOutBox!.y + desktopSignOutBox!.height).toBeGreaterThan(850)
  const desktopHomeScreenshot = join(screenshotDirectory, `course-nav-${testInfo.project.name}-home-desktop.png`)
  await page.screenshot({ path: desktopHomeScreenshot, fullPage: true })
  await testInfo.attach('home-desktop', { path: desktopHomeScreenshot, contentType: 'image/png' })
  await card.getByRole('link', { name: 'Open Game Design' }).click()

  await expect(page).toHaveURL(/FeedbackAnalyzer\.html$/)
  await expect(page.getByRole('navigation', { name: 'Instructor navigation' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Instructor navigation' })).toContainText('Feedback Analyzer')
  await expect.poll(() => page.getByRole('navigation', { name: 'Instructor navigation' })
    .getByRole('link', { name: 'Feedback Analyzer' }).evaluate(element => getComputedStyle(element).fontSize))
    .toBe('16px')
  const analyzerLink = page.getByRole('navigation', { name: 'Instructor navigation' })
    .getByRole('link', { name: 'Feedback Analyzer' })
  await expect.poll(() => analyzerLink.evaluate(element => element.getBoundingClientRect().height))
    .toBeLessThanOrEqual(50)
  await expect(page.getByRole('navigation', { name: 'Instructor navigation' })).toContainText('Prompt Designer')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight))
    .toBe(true)
  await expect.poll(async () => {
    const box = await page.locator('aside').first().getByRole('button', { name: 'Sign out' }).boundingBox()
    return box ? box.y + box.height : 0
  }).toBeGreaterThan(850)
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('leai:local:selected-course')))
    .toBe('11111111-1111-4111-8111-111111111111')
  const desktopCourseScreenshot = join(screenshotDirectory, `course-nav-${testInfo.project.name}-course-desktop.png`)
  await page.screenshot({ path: desktopCourseScreenshot, fullPage: true })
  await testInfo.attach('course-desktop', { path: desktopCourseScreenshot, contentType: 'image/png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/InstructorHome.html')
  await expect(page.getByRole('navigation', { name: 'Course navigation' })).toHaveCount(0)
  const mobileHomeScreenshot = join(screenshotDirectory, `course-nav-${testInfo.project.name}-home-mobile.png`)
  await page.screenshot({ path: mobileHomeScreenshot, fullPage: true })
  await testInfo.attach('home-mobile', { path: mobileHomeScreenshot, contentType: 'image/png' })
  await page.getByRole('article', { name: 'Game Design' }).getByRole('link', { name: 'Open Game Design' }).click()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  const mobileCourseNavigation = page.getByRole('dialog', { name: 'Navigation' })
    .getByRole('navigation', { name: 'Instructor navigation' })
  await expect(mobileCourseNavigation).toBeVisible()
  await expect(mobileCourseNavigation).toContainText('Feedback Analyzer')
  const mobileDialog = page.getByRole('dialog', { name: 'Navigation' })
  const panelBackground = await mobileDialog.evaluate(element => getComputedStyle(element).backgroundColor)
  await expect.poll(() => mobileCourseNavigation.locator('..').evaluate(element => getComputedStyle(element).backgroundColor))
    .toBe(panelBackground)
  const accountFontSize = await mobileCourseNavigation.getByRole('link', { name: 'Account' }).locator('span')
    .evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))
  const courseFontSize = await mobileCourseNavigation.getByRole('link', { name: 'Feedback Analyzer' }).locator('span')
    .evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(accountFontSize).toBeCloseTo(16 * 96 / 72, 1)
  expect(courseFontSize).toBeCloseTo(16 * 96 / 72, 1)
  const signOutFontSize = await mobileDialog.getByRole('button', { name: 'Sign out' })
    .evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(signOutFontSize).toBeCloseTo(16 * 96 / 72, 1)
  await page.waitForTimeout(300)
  const mobileSignOut = page.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: 'Sign out' })
  await expect.poll(async () => {
    const box = await mobileSignOut.boundingBox()
    return box ? box.y + box.height : 0
  }).toBeGreaterThan(790)
  const mobileCourseScreenshot = join(screenshotDirectory, `course-nav-${testInfo.project.name}-course-mobile.png`)
  await page.screenshot({ path: mobileCourseScreenshot, fullPage: true })
  await testInfo.attach('course-mobile', { path: mobileCourseScreenshot, contentType: 'image/png' })
})

test('missing course context redirects to the dedicated 404 without course navigation', async ({ page }, testInfo) => {
  await page.route('**/datapipeline/api/v1/instructor_courses/', (route) => route.fulfill({
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    json: { courses: [] },
  }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/FeedbackAnalyzer.html')

  await expect(page).toHaveURL(/NotFound\.html$/)
  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('navigation', { name: 'Account navigation' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Course navigation' })).toHaveCount(0)
  const screenshotDirectory = join(process.cwd(), '.web-verify', 'screenshots')
  await mkdir(screenshotDirectory, { recursive: true })
  const desktopShot = join(screenshotDirectory, `course-not-found-desktop-${testInfo.project.name}.png`)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: desktopShot, fullPage: true })
  await testInfo.attach('not-found-desktop', { path: desktopShot, contentType: 'image/png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  const mobileNavigation = page.getByRole('dialog', { name: 'Navigation' })
  await expect(mobileNavigation.getByRole('navigation', { name: 'Account navigation' })).toBeVisible()
  await expect(mobileNavigation.getByRole('navigation', { name: 'Course navigation' })).toHaveCount(0)
  await expect(mobileNavigation.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await page.waitForTimeout(350)
  const mobileShot = join(screenshotDirectory, `course-not-found-mobile-${testInfo.project.name}.png`)
  await page.screenshot({ path: mobileShot, fullPage: true })
  await testInfo.attach('not-found-mobile-drawer', { path: mobileShot, contentType: 'image/png' })
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('leai:local:selected-course'))).toBeNull()
})

test('keeps student consent and conversation body copy at the regular 16px size', async ({ page }, testInfo) => {
  const surveyId = '550e8400-e29b-41d4-a716-446655440010'
  const sessionId = '550e8400-e29b-41d4-a716-446655440011'
  const token = 'a'.repeat(64)
  await page.route(`**/datapipeline/api/v1/surveys/${surveyId}/`, (route) => route.fulfill({
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    json: {
      survey_id: surveyId, label: 'Typography review', intro: 'Welcome to the course reflection.',
      available: true, anonymous_matching_enabled: false,
      completion_certificate_enabled: false, completed_response_download_enabled: false,
    },
  }))
  await page.route(`**/datapipeline/api/v1/surveys/${surveyId}/debug-access/`, (route) => route.fulfill({
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    json: { enabled: false },
  }))
  await page.route(`**/datapipeline/api/v1/surveys/${surveyId}/sessions/${sessionId}/`, (route) => route.fulfill({
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    json: {
      session_id: sessionId, survey_id: surveyId, turn_version: 1, status: 'active',
      prompt: { item_id: 'P1', phase: 'answer', text: 'Share your thoughts.', wording: 'exact', choices: null },
      progress_label: 'Question 1 of 1', results: {}, answer_map: {},
      messages: [{ id: 1, sequence: 1, role: 'assistant', content: 'Tell us about the course.', attribution: {} }],
    },
  }))
  await page.setViewportSize({ width: 1022, height: 844 })
  await page.goto(`/feedback.html?id=${surveyId}`)
  const consent = page.getByRole('dialog', { name: 'Before you begin' })
  await expect(consent).toBeVisible()
  for (const text of [consent.locator('.student-consent-header p'), consent.locator('.student-consent-checkbox').first(), consent.getByRole('button', { name: 'Continue' })]) {
    await expect.poll(() => text.evaluate(element => getComputedStyle(element).fontSize)).toBe('16px')
  }
  const screenshotDirectory = join(process.cwd(), '.web-verify', 'screenshots')
  await mkdir(screenshotDirectory, { recursive: true })
  const consentScreenshot = join(screenshotDirectory, 'typography-student-consent-chromium.png')
  await page.screenshot({ path: consentScreenshot, fullPage: true })
  await testInfo.attach('student-consent', { path: consentScreenshot, contentType: 'image/png' })

  await page.evaluate(({ surveyId, sessionId, token }) => {
    sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  }, { surveyId, sessionId, token })
  await page.reload()
  const message = page.getByRole('log', { name: 'Conversation' }).getByText('Tell us about the course.')
  await expect(message).toBeVisible()
  await expect.poll(() => message.evaluate(element => getComputedStyle(element).fontSize)).toBe('16px')
  const composer = page.getByRole('textbox', { name: 'Message' })
  await expect(composer).toBeVisible()
  await expect.poll(() => composer.evaluate(element => getComputedStyle(element).fontSize)).toBe('16px')
  const conversationScreenshot = join(screenshotDirectory, 'typography-student-conversation-chromium.png')
  await page.screenshot({ path: conversationScreenshot, fullPage: true })
  await testInfo.attach('student-conversation', { path: conversationScreenshot, contentType: 'image/png' })
})

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
  ['/Customizations.html', 'Settings'],
  ['/NotFound.html', 'Page Not Found'],
  ['/feedback.html', 'Reflection'],
]) {
  test(`mounts ${path} without a rewrite`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })
}
