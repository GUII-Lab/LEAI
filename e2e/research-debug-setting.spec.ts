import { expect, test, type Route } from '@playwright/test'

const apiBase = '**/datapipeline/api/v1/'
const courseId = '11111111-1111-4111-8111-111111111111'
const surveyId = '550e8400-e29b-41d4-a716-446655440010'
const sessionId = '550e8400-e29b-41d4-a716-446655440011'
const studentToken = 'a'.repeat(64)

const studentSession = (messages = []) => ({
  session_id: sessionId,
  survey_id: surveyId,
  turn_version: 1,
  status: 'active',
  prompt: { item_id: 'P1', phase: 'answer', text: 'What information matters for your task?', wording: 'exact', choices: null },
  progress_label: 'Area 1 of 3 — Planning · Question 1 of 4',
  results: {}, answer_map: {}, messages,
})

test('researcher enables QA debug and only their authenticated view reveals it in the real student page', async ({ page, context, browser }, testInfo) => {
  let debugEnabled = false
  let settingsVersion = 1
  let debugReadCount = 0
  // This UI fixture simulates server authorization. Actual cookie/CSRF behavior
  // is verified separately against Django, not inferred from intercepted headers.
  const handleRoute = (authenticated: boolean) => async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const auth = request.headers().authorization
    if ((url.pathname.includes('/instructor_') || url.pathname.includes('/debug')) && !authenticated) {
      await route.fulfill({ status: 401, json: { error: 'authentication_required' } })
      return
    }
    if (url.pathname.endsWith('/environment/')) {
      await route.fulfill({ json: { environment: 'local', backend_build_sha: 'local-backend', schema_identity: 'public',
        contract_version: '2026-09-21', allowed_app_bases: ['/'], server_time: '2026-09-26T19:00:00Z' } })
    } else if (url.pathname.endsWith('/instructor_me/')) {
      expect(auth).toBeUndefined()
      await route.fulfill({ json: { id: '550e8400-e29b-41d4-a716-446655440012', email: 'researcher@ucsc.edu',
        display_name: 'Researcher', must_change_password: false, platform_role: 'member', institutions: [] } })
    } else if (url.pathname.endsWith('/instructor_courses/')) {
      expect(auth).toBeUndefined()
      await route.fulfill({ json: { courses: [{ course_id: courseId, course_code: 'CMPM-80H', course_name: 'CMPM 80H',
        institution_slug: 'ucsc', lifecycle_state: 'active', role: 'researcher', allowed_actions: [] }] } })
    } else if (url.pathname.endsWith('/debug-settings/')) {
      expect(auth).toBeUndefined()
      if (request.method() === 'PATCH') {
        expect(request.headers()['x-csrftoken']).toBe('test-csrf')
        const body = request.postDataJSON() as { debug_enabled: boolean; expected_settings_version: number }
        expect(body.expected_settings_version).toBe(settingsVersion)
        debugEnabled = body.debug_enabled
        settingsVersion += 1
      }
      await route.fulfill({ json: { debug_enabled: debugEnabled, settings_version: settingsVersion } })
    } else if (url.pathname.endsWith('/instructor_csrf/')) {
      await route.fulfill({ json: { csrf_token: 'test-csrf' } })
    } else if (url.pathname === `/datapipeline/api/v1/surveys/${surveyId}/`) {
      await route.fulfill({ json: { survey_id: surveyId, label: 'QA test reflection', intro: 'Welcome.', available: true,
        anonymous_matching_enabled: false,
        completion_certificate_enabled: false, completed_response_download_enabled: false } })
    } else if (url.pathname === `/datapipeline/api/v1/surveys/${surveyId}/sessions/` && request.method() === 'POST') {
      await route.fulfill({ status: 201, json: { ...studentSession([
        { id: 1, sequence: 1, role: 'assistant', content: 'Welcome.', attribution: { phase: 'intro' } },
        { id: 2, sequence: 2, role: 'assistant', content: 'What information matters for your task?', attribution: { item_id: 'P1', phase: 'answer' } },
      ]), token: studentToken } })
    } else if (url.pathname === `/datapipeline/api/v1/surveys/${surveyId}/debug-access/`) {
      expect(auth).toBeUndefined()
      await route.fulfill({ json: { enabled: debugEnabled } })
    } else if (url.pathname === `/datapipeline/api/v1/surveys/${surveyId}/sessions/${sessionId}/debug/`) {
      expect(auth).toBeUndefined()
      debugReadCount += 1
      await route.fulfill({ json: { session_id: sessionId, turn_version: 1,
        schema_state: { item_index: 0, phase: 'answer', results: {}, answer_map: {}, evidence_seen: {}, coverage_seen: {} }, responses: [] } })
    } else if (url.pathname === `/datapipeline/api/v1/surveys/${surveyId}/sessions/${sessionId}/`) {
      expect(auth).toBe(`Bearer ${studentToken}`)
      await route.fulfill({ json: studentSession([
        { id: 1, sequence: 1, role: 'assistant', content: 'Welcome.', attribution: { phase: 'intro' } },
        { id: 2, sequence: 2, role: 'assistant', content: 'What information matters for your task?', attribution: { item_id: 'P1', phase: 'answer' } },
      ]) })
    } else {
      await route.fulfill({ status: 404, json: { error: 'not_found' } })
    }
  }
  await context.route(`${apiBase}**`, handleRoute(true))
  await page.addInitScript(() => sessionStorage.setItem('leai:local:selected-course', '11111111-1111-4111-8111-111111111111'))

  await page.goto('/Customizations.html')
  await expect(page.getByRole('heading', { name: 'AI debug visibility' })).toBeVisible()
  const toggle = page.getByRole('switch', { name: 'Enable AI debug panel' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(toggle).toHaveAttribute('data-state', 'checked')
  await expect(toggle.locator('span')).toHaveClass(/translate-x-5/)
  await expect(page.getByText('Researcher debug setting saved.')).toBeVisible()
  await page.waitForTimeout(250)
  await page.screenshot({ path: testInfo.outputPath('researcher-customizations-enabled.png'), fullPage: true })

  await page.goto(`/feedback.html?id=${surveyId}`)
  await page.getByRole('dialog', { name: 'Before you begin' }).getByRole('checkbox', { name: /I have read and agree/i }).check()
  await page.getByRole('dialog', { name: 'Before you begin' }).getByRole('button', { name: 'Continue' }).click()
  const debugToggle = page.getByRole('button', { name: 'Show debug state' })
  await expect(debugToggle).toBeVisible()
  await debugToggle.click()
  await expect(page.getByText('Recorded schema state')).toBeVisible()
  await expect.poll(() => debugReadCount).toBe(1)
  await page.screenshot({ path: testInfo.outputPath('researcher-student-debug-visible.png'), fullPage: true })

  const publicContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  await publicContext.route(`${apiBase}**`, handleRoute(false))
  const publicPage = await publicContext.newPage()
  await publicPage.goto(`/feedback.html?id=${surveyId}`)
  await publicPage.getByRole('dialog', { name: 'Before you begin' }).getByRole('checkbox', { name: /I have read and agree/i }).check()
  await publicPage.getByRole('dialog', { name: 'Before you begin' }).getByRole('button', { name: 'Continue' }).click()
  await expect(publicPage.getByRole('dialog', { name: 'Before you begin' })).toBeHidden()
  await expect(publicPage.getByText('What information matters for your task?')).toBeVisible()
  await expect(publicPage.getByRole('button', { name: /debug state/i })).toHaveCount(0)
  await publicPage.screenshot({ path: testInfo.outputPath('student-view-debug-hidden.png'), fullPage: true })
  await publicContext.close()
  expect(debugReadCount).toBe(1)
})
