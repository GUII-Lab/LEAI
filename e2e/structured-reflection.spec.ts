import { expect, test } from '@playwright/test'
import type { StudentSession } from '../src/api/student'

const surveyId = '550e8400-e29b-41d4-a716-446655440010'
const sessionId = '550e8400-e29b-41d4-a716-446655440011'
const question = 'I think about the work. Use 1 (Strongly disagree) to 5 (Strongly agree), and explain why.'

// Real student page and API client, isolated transport fixtures only.
// Backend extraction/persistence is covered separately by the optional live spec.
for (const withChoices of [false, true]) {
for (const width of [390, 820, 1022, 1440]) {
  test(`Likert uses ordinary chat at ${width}px with choices ${withChoices ? 'data' : 'null'}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    const turns: unknown[] = []
    let session: StudentSession = {
      session_id: sessionId, survey_id: surveyId, turn_version: 1, status: 'active',
      prompt: { item_id: 'P1', phase: 'rating', text: question, wording: 'exact', choices: withChoices ? [
        { value: 1, label: 'Strongly disagree' }, { value: 2, label: 'Disagree' },
        { value: 3, label: 'Neutral' }, { value: 4, label: 'Agree' }, { value: 5, label: 'Strongly agree' },
      ] : null },
      progress_label: 'Question 1', results: {}, answer_map: {},
      messages: [{ id: 1, sequence: 1, role: 'assistant', content: question, attribution: { item_id: 'P1', phase: 'rating' } }],
    }
    await page.route('**/datapipeline/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/environment/')) return route.fulfill({ json: {
        environment: 'local', backend_build_sha: 'local-backend', schema_identity: 'public',
        contract_version: '2026-09-21', allowed_app_bases: ['/'], server_time: '2026-09-29T12:00:00Z',
      } })
      if (path.endsWith('/debug-access/')) return route.fulfill({ json: { enabled: false } })
      if (path.endsWith(`/surveys/${surveyId}/`)) return route.fulfill({ json: {
        survey_id: surveyId, label: 'Structured Reflection', intro: 'Welcome to reflection.', available: true,
        anonymous_matching_enabled: false, completion_certificate_enabled: false, completed_response_download_enabled: false,
      } })
      if (path.endsWith('/sessions/')) return route.fulfill({ json: { ...session, token: 'a'.repeat(64) } })
      if (path.endsWith('/turns/')) {
        const turn = route.request().postDataJSON()
        turns.push(turn)
        // Keep the backend in rating phase to exercise ambiguity and textual skip without client inference.
        session = { ...session, turn_version: session.turn_version + 1, messages: [...session.messages,
          { id: session.messages.length + 1, sequence: session.messages.length + 1, role: 'student', content: turn.text, attribution: { item_id: 'P1', phase: 'rating' } },
        ] }
        return route.fulfill({ json: session })
      }
      if (path.endsWith(`/sessions/${sessionId}/`)) return route.fulfill({ json: session })
      return route.fulfill({ status: 404, json: {} })
    })
    await page.goto(`/feedback.html?id=${surveyId}`)
    const consent = page.getByRole('dialog', { name: 'Before you begin' })
    await expect(consent.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await consent.getByRole('checkbox', { name: /I have read and agree/i }).check()
    await consent.getByRole('button', { name: 'Continue' }).click()
    await expect(consent).toHaveCount(0)
    const composer = page.getByTestId('chat-composer')
    const input = composer.getByRole('textbox', { name: 'Message' })
    await expect(input).toBeVisible()
    await expect(input).toBeEnabled()
    await expect(page.getByRole('log', { name: 'Conversation' })).toContainText(question)
    await expect(page.getByRole('radio')).toHaveCount(0)
    await expect(page.getByRole('combobox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Agree', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Prefer not to answer' })).toHaveCount(0)
    await expect(composer.getByRole('button', { name: 'Dictate' })).toBeVisible()
    await expect(page.getByRole('button', { name: /debug state/i })).toHaveCount(0)
    await expect(composer).toHaveCSS('border-radius', '26px')
    await expect(input).toHaveCSS('border-top-width', '0px')
    await input.fill('   ')
    await expect(composer.getByRole('button', { name: 'Send' })).toBeDisabled()
    const text = 'I would say four, because I think through the task.'
    await input.fill(text)
    await expect(composer.getByRole('button', { name: 'Send' })).toBeEnabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await testInfo.attach(`likert-chat-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    if (width >= 640) await input.press('Enter')
    else await composer.getByRole('button', { name: 'Send' }).click()
    await expect(input).toHaveValue('')
    expect(turns).toEqual([{ expected_version: 1, item_id: 'P1', kind: 'text', text }])
    await expect(page.getByRole('log', { name: 'Conversation' })).toContainText(text)
    await input.fill('Prefer not to answer')
    await composer.getByRole('button', { name: 'Send' }).click()
    await expect(input).toHaveValue('')
    expect(turns).toHaveLength(2)
    expect(turns[1]).toEqual({ expected_version: 2, item_id: 'P1', kind: 'text', text: 'Prefer not to answer' })
    await page.reload()
    await expect(page.getByRole('log', { name: 'Conversation' }).getByText(text, { exact: true })).toHaveCount(1)
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeEnabled()
  })
}
}
