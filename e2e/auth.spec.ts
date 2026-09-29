import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/datapipeline/api/v1/environment/', route => route.fulfill({ json: {
    environment: 'local', backend_build_sha: 'local-backend', schema_identity: 'public',
    contract_version: '2026-09-21', allowed_app_bases: ['/'], server_time: '2026-09-27T12:00:00Z',
  } }))
  await page.route('**/datapipeline/api/v1/instructor_me/', route => route.fulfill({
    status: 401, json: { error: 'authentication_required' },
  }))
})

const protectedPages = [
  { path: '/InstructorHome.html', title: 'LEAI' },
  { path: '/PromptDesigner.html', title: 'Prompt Designer' },
  { path: '/FeedbackAnalyzer.html', title: 'Feedback Analyzer' },
  { path: '/FeedbackChat.html', title: 'Feedback Chat' },
  { path: '/CourseBanner.html', title: 'Course Banner' },
  { path: '/Customizations.html', title: 'Customizations' },
]

for (const { path, title } of protectedPages) {
  test(`redirects signed-out visits to ${path} to the full sign-in page`, async ({ page }) => {
    await page.goto(path)

    await expect(page).toHaveURL(/InstructorLogin\.html\?next=/)
    await expect(page.getByRole('heading', { name: 'Instructor sign in' })).toBeVisible()
    await expect(page.getByRole('heading', { name: title })).not.toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })
}

test('signed-out cited-response link preserves its authorized return parameters', async ({ page }) => {
  const deepLink = '/FeedbackAnalyzer.html?course_id=11111111-1111-4111-8111-111111111111&occurrence_id=22222222-2222-4222-8222-222222222222&response_id=33333333-3333-4333-8333-333333333333&response_message_id=55'
  await page.goto(deepLink)
  await expect(page.getByRole('heading', { name: 'Instructor sign in' })).toBeVisible()
  expect(new URL(page.url()).searchParams.get('next')).toBe(deepLink)
})

test('sign-in returns to an authorized Analyzer course deep link', async ({ page }) => {
  const courseId = '11111111-1111-4111-8111-111111111111'
  const deepLink = `/FeedbackAnalyzer.html?course_id=${courseId}`
  const api = '**/datapipeline/api/v1/'
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
  let authenticated = false
  await page.route(`${api}instructor_sessions/`, async (route) => {
    authenticated = true
    await route.fulfill({ status: 201, headers, json: { expires_at: '2026-09-29T20:00:00Z', must_change_password: false } })
  })
  await page.route(`${api}instructor_csrf/`, (route) => route.fulfill({ headers, json: { csrf_token: 'safe-csrf-token' } }))
  await page.route(`${api}instructor_me/`, (route) => authenticated
    ? route.fulfill({ headers, json: { id: '550e8400-e29b-41d4-a716-446655440001', email: 'teacher@ucsc.edu', display_name: 'Teacher', platform_role: 'member', must_change_password: false, institutions: [] } })
    : route.fulfill({ status: 401, headers, json: { error: 'authentication_required' } }))
  await page.route(`${api}instructor_courses/`, (route) => route.fulfill({ headers, json: { courses: [{
    course_id: courseId, course_code: 'cmpm-80h', course_name: 'Game Design', institution_slug: 'ucsc',
    lifecycle_state: 'active', role: 'owner', allowed_actions: ['analysis.use', 'responses.view'],
  }] } }))
  await page.goto(deepLink)
  await expect(page.getByRole('heading', { name: 'Instructor sign in' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Email' }).fill('teacher@ucsc.edu')
  await page.getByLabel('Password').fill('Test-Password-Only-2026!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(new RegExp(`FeedbackAnalyzer\\.html\\?course_id=${courseId}$`))
  await expect(page.getByRole('heading', { name: 'Feedback Analyzer' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('leai:local:selected-course'))).toBe(courseId)
})

test('sign-in uses the Inter typeface from the pinned LEAI interface', async ({ page }) => {
  await page.goto('/InstructorLogin.html')

  await expect(page.getByRole('heading', { name: 'Instructor sign in' })).toBeVisible()
  await expect.poll(() => page.getByRole('heading', { name: 'Instructor sign in' })
    .evaluate(element => getComputedStyle(element).fontFamily))
    .toContain('Inter')
})

test('keeps student feedback public', async ({ page }) => {
  await page.goto('/feedback.html')
  await expect(page).not.toHaveURL(/InstructorLogin\.html/)
})

test('redirects an expired instructor session to the full sign-in page', async ({ page }) => {
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
    status: 401, headers, json: { error: 'authentication_required' },
  }))
  await page.goto('/feedback.html')
  await page.evaluate(() => sessionStorage.setItem('leai:local:instructor-token', 'expired-token'))
  await page.goto('/FeedbackAnalyzer.html')

  await expect(page).toHaveURL(/InstructorLogin\.html\?next=/)
  await expect(page.getByRole('heading', { name: 'Instructor sign in' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('leai:local:instructor-token')))
    .toBeNull()
})

test('explains a backend identity mismatch instead of leaving a signed-in page checking forever', async ({ page }) => {
  await page.route('**/datapipeline/api/v1/environment/', (route) => route.fulfill({
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    json: {
      environment: 'qa', backend_build_sha: 'unexpected-backend', schema_identity: 'unexpected',
      contract_version: '2026-09-21', allowed_app_bases: ['/'], server_time: '2026-09-24T12:00:00Z',
    },
  }))
  await page.goto('/feedback.html')
  await page.evaluate(() => sessionStorage.setItem('leai:local:instructor-token', 'stale-token'))
  await page.goto('/FeedbackAnalyzer.html')

  await expect(page.getByText('Read-only mode.')).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Instructor sign-in is unavailable' })).toBeVisible()
  await expect(page.getByText('Checking your account…')).not.toBeVisible()
})

test('rejects an external sign-in return target and uses the instructor home page', async ({ page }) => {
  const api = '**/datapipeline/api/v1/'
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
  let authenticated = false
  await page.route(`${api}environment/`, (route) => route.fulfill({
    headers,
    json: {
      environment: 'local', backend_build_sha: 'local-backend', schema_identity: 'public',
      contract_version: '2026-09-21', allowed_app_bases: ['/'], server_time: '2026-09-24T12:00:00Z',
    },
  }))
  await page.route(`${api}instructor_sessions/`, (route) => route.fulfill({
    status: 201, headers,
    json: { expires_at: '2026-09-24T13:00:00Z', must_change_password: false },
  }).then(() => { authenticated = true }))
  await page.route(`${api}instructor_csrf/`, (route) => route.fulfill({ headers, json: { csrf_token: 'safe-csrf-token' } }))
  await page.route(`${api}instructor_me/`, (route) => authenticated
    ? route.fulfill({ headers, json: {
      id: '550e8400-e29b-41d4-a716-446655440001', email: 'teacher@ucsc.edu',
      display_name: 'Teacher', platform_role: 'member', must_change_password: false,
      institutions: [],
    } })
    : route.fulfill({ status: 401, headers, json: { error: 'authentication_required' } }))
  await page.goto('/InstructorLogin.html?next=https%3A%2F%2Fevil.example')

  await expect(page.getByRole('heading', { name: 'Instructor sign in' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Email' }).fill('teacher@ucsc.edu')
  await page.getByLabel('Password').fill('Test-Password-Only-2026!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/InstructorHome\.html$/)
})

for (const width of [390, 820, 1022, 1440]) {
  test(`keeps the sign-in page usable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/InstructorLogin.html')

    await expect(page.getByRole('heading', { name: 'Instructor sign in' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)
  })
}

test('routes a course deep link to Not Found after login when no course was selected', async ({ page }) => {
  const api = '**/datapipeline/api/v1/'
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
  let authenticated = false
  await page.route(`${api}environment/`, (route) => route.fulfill({
    headers,
    json: {
      environment: 'local', backend_build_sha: 'local-backend', schema_identity: 'public',
      contract_version: '2026-09-21', allowed_app_bases: ['/'], server_time: '2026-09-24T12:00:00Z',
    },
  }))
  await page.route(`${api}instructor_sessions/`, async (route) => {
    authenticated = true
    await route.fulfill({
      status: 201, headers,
      json: { expires_at: '2026-09-24T13:00:00Z', must_change_password: true },
    })
  })
  await page.route(`${api}instructor_csrf/`, (route) => route.fulfill({ headers, json: { csrf_token: 'safe-csrf-token' } }))
  await page.route(`${api}instructor_me/`, (route) => authenticated
    ? route.fulfill({ headers, json: {
      id: '550e8400-e29b-41d4-a716-446655440001', email: 'teacher@ucsc.edu',
      display_name: 'Teacher', platform_role: 'member',
      must_change_password: true, institutions: [],
    } })
    : route.fulfill({ status: 401, headers, json: { error: 'authentication_required' } }))
  await page.route(`${api}instructor_courses/`, (route) => route.fulfill({ headers, json: { courses: [] } }))

  await page.goto('/FeedbackAnalyzer.html')
  await expect(page).toHaveURL(/InstructorLogin\.html/)
  await page.getByRole('textbox', { name: 'Email' }).fill('teacher@ucsc.edu')
  await page.getByLabel('Password').fill('Test-Password-Only-2026!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/NotFound\.html$/)
  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Course navigation' })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('leai:local:instructor-token')))
    .toBeNull()
})
