import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const courseId = '550e8400-e29b-41d4-a716-446655440000'
const occurrenceId = '550e8400-e29b-41d4-a716-446655440010'
const chatId = '550e8400-e29b-41d4-a716-446655440020'
const responseId = '550e8400-e29b-41d4-a716-446655440030'
const wizardDraftId = '550e8400-e29b-41d4-a716-446655440060'
const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
const course = { course_id: courseId, course_code: 'cmpm-80h', course_name: 'Game Design', institution_slug: 'ucsc', lifecycle_state: 'active', role: 'owner', allowed_actions: ['course.manage', 'feedback.author', 'feedback.publish', 'analysis.use', 'responses.view'] }
const metrics = { response_count: 1, student_turn_count: 2, pdf_response_count: 0, average_words: 12, participation: { state: 'unavailable', reason: 'eligible_denominator_missing' }, turn_distribution: { state: 'unavailable', reason: 'insufficient_occurrences' }, question_health: { state: 'unavailable', reason: 'exact_structured_identifiers_unavailable' } }
const overview = { course: { id: courseId, name: 'Game Design' }, selected_occurrence_ids: [occurrenceId], occurrences: [{ id: occurrenceId, label: 'Week 1 feedback', mode: 'general', audience: 'individual', collection_style: 'guided', completion_certificate_enabled: false, schema_family_id: occurrenceId, created_at: '2026-09-27T12:00:00Z', metrics }], summary: metrics, team_surveys: [] }
const response = { kind: 'chat', response_id: responseId, label: 'R1', survey_label: 'Week 1 feedback', created_at: '2026-09-27T12:20:00Z', nudged: false, response_href: '#', transcript: [{ message_id: '21', content: 'The weekly instructions were clear.', timestamp: '2026-09-27T12:20:00Z' }], answers: [], occurrence_id: occurrenceId, team_snapshot_id: null, team_snapshot_item_id: null, team_label: null, team_configuration_label: null, source: 'student' }
const chat = { id: chatId, title: 'Week 1 feedback', prompt_override: null, archived: false, updated_at: '2026-09-27T12:30:00Z', sources: [{ id: occurrenceId, label: 'Week 1 feedback', revision: 1 }], messages: [{ id: '10', sequence: 1, role: 'user', content: 'What should change?', created_at: '2026-09-27T12:30:00Z', citations: [] }, { id: '11', sequence: 2, role: 'assistant', content: 'Students want clearer weekly steps. [1]', created_at: '2026-09-27T12:31:00Z', citations: [{ id: '9', citation_number: 1, claim_key: 'clarity', response_id: responseId, response_message_id: 21, occurrence_id: occurrenceId, week_label: 'Week 1', survey_label: 'Week 1 feedback', question_label: null, evidence_quote: 'The weekly instructions were clear.' }] }] }
const wizardDraft = { id: wizardDraftId, title: 'Weekly reflection', audience: 'individual', collection_style: 'guided', draft_version: 1,
  body: { version: 1, title: 'Weekly reflection', intro: 'Tell us about this week.', scales: {}, sections: [{ id: 's1', title: 'Learning', items: [{ id: 'q1', prompt: 'What stood out this week?', wording: 'adaptive', response: { kind: 'text' }, reflection_goal: 'Understand a concrete moment.', coverage_targets: [], example_probes: [], max_additional_probes: 1 }] }] },
  updated_at: '2026-09-28T12:00:00Z', resumable: true }

test.beforeEach(async ({ page }) => {
  await page.route('**/datapipeline/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let json: unknown
    if (path.endsWith('/environment/')) json = { environment: 'local', backend_build_sha: 'local-backend', schema_identity: 'public', contract_version: '2026-09-21', allowed_app_bases: ['/'], server_time: '2026-09-28T12:00:00Z' }
    else if (path.endsWith('/instructor_csrf/')) json = { csrf_token: 'visual-test-csrf' }
    else if (path.endsWith('/instructor_me/')) json = { id: '550e8400-e29b-41d4-a716-446655440001', email: 'teacher@example.edu', display_name: 'Teacher', platform_role: 'member', must_change_password: false, institutions: [] }
    else if (path.endsWith('/instructor_courses/')) json = { courses: [course] }
    else if (path.endsWith('/analysis/overview/')) json = overview
    else if (path.endsWith('/analysis/ngrams/')) json = { source_count: 1, cutoff_at: '2026-09-27T12:20:00Z', keyness_available: false, items: [{ term: 'clear instructions', count: 1, keyness: null }] }
    else if (path.endsWith('/analysis/responses/')) json = { results: [response], has_more: false, next_cursor: null }
    else if (path.endsWith('/analysis/occurrences/')) json = { occurrences: [{ id: occurrenceId, label: 'Week 1 feedback', revision: 1 }] }
    else if (path.endsWith('/analysis/chats/')) json = { chats: [{ id: chatId, title: chat.title, updated_at: chat.updated_at }] }
    else if (path.endsWith(`/analysis/chats/${chatId}/`)) json = chat
    else if (path.endsWith('/question-set-templates/')) json = { templates: [{ id: 'weekly-reflection', name: 'Weekly reflection', description: 'A weekly check-in.', audience: 'individual', collection_style: 'guided', source: 'leai' }] }
    else if (path.endsWith('/question-sets/')) json = route.request().method() === 'POST' ? wizardDraft : { question_sets: [] }
    else if (path.endsWith(`/question-sets/${wizardDraftId}/draft/`)) json = wizardDraft
    else if (path.endsWith(`/question-sets/${wizardDraftId}/versions/`)) json = { versions: [] }
    else if (path.endsWith(`/question-sets/${wizardDraftId}/conversation/`)) json = { messages: [] }
    else if (path.endsWith('/surveys/')) json = { surveys: [] }
    else return route.fulfill({ status: 404, headers, json: { detail: 'No visual test fixture for this path.' } })
    await route.fulfill({ headers, json })
  })
  await page.addInitScript(({ id }) => {
    sessionStorage.setItem('leai:local:instructor-token', 'visual-test-token')
    sessionStorage.setItem('leai:local:selected-course', id)
  }, { id: courseId })
})

for (const width of [390, 820, 1022, 1440]) {
  test(`three instructor pages fit ${width}px and expose their QA interactions`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const directory = join(process.cwd(), '.web-verify', 'screenshots')
    await mkdir(directory, { recursive: true })
    const shot = async (name: string) => {
      const path = join(directory, `legacy-parity-${name}-${width}-${testInfo.project.name}.png`)
      await page.screenshot({ path, fullPage: true })
      await testInfo.attach(name, { path, contentType: 'image/png' })
    }
    const fit = async () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const assertInstructorHomeNavigationTheme = async () => {
      let navigation = page.getByRole('navigation', { name: 'Instructor navigation' })
      if (width < 1024) {
        await page.getByRole('button', { name: 'Open navigation' }).click()
        navigation = page.getByRole('dialog', { name: 'Navigation' }).getByRole('navigation', { name: 'Instructor navigation' })
      }
      const active = navigation.locator('[aria-current="page"]')
      await expect.poll(() => navigation.locator('..').evaluate(element => getComputedStyle(element).backgroundColor))
        .toBe('rgb(23, 42, 51)')
      await expect.poll(() => active.evaluate(element => getComputedStyle(element).backgroundColor))
        .toBe('rgb(228, 243, 249)')
      await expect.poll(() => active.evaluate(element => getComputedStyle(element).color))
        .toBe('rgb(13, 80, 111)')
      if (width < 1024) await page.keyboard.press('Escape')
    }

    await page.goto('/PromptDesigner.html')
    await expect(page.getByRole('heading', { name: 'Prompt Designer' })).toBeVisible()
    await expect.poll(() => page.getByRole('heading', { name: 'Prompt Designer' }).evaluate(element => getComputedStyle(element).fontSize)).toBe(width === 390 ? '28px' : '44px')
    await assertInstructorHomeNavigationTheme()
    await fit()
    if (width === 390 || width === 1440) await shot('prompt-home')
    await page.getByRole('button', { name: 'Create new feedback' }).click()
    await expect(page.getByRole('heading', { name: 'Who are you collecting feedback from?' })).toBeVisible()
    await page.waitForTimeout(250)
    await fit()
    if (width === 390 || width === 1440) await shot('prompt-audience')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'How should the conversation work?' })).toBeVisible()
    await page.waitForTimeout(250)
    await fit()
    if (width === 390 || width === 1440) await shot('prompt-starting-point')
    await page.getByRole('button', { name: 'Close builder' }).click()
    await expect(page.getByRole('alertdialog', { name: 'Leave the Builder?' })).toBeVisible()
    if (width === 390 || width === 1440) { await page.waitForTimeout(200); await shot('prompt-close-dialog') }
    await page.getByRole('button', { name: 'Keep editing' }).click()

    await page.goto('/FeedbackChat.html')
    await expect(page.getByRole('heading', { name: 'Feedback Chat' })).toBeVisible()
    await expect.poll(() => page.getByRole('heading', { name: 'Feedback Chat' }).evaluate(element => getComputedStyle(element).fontSize)).toBe(width === 390 ? '28px' : '44px')
    await assertInstructorHomeNavigationTheme()
    await expect(page.getByRole('region', { name: 'Feedback Chat workspace' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open citation 1' })).toBeVisible()
    await fit()
    if (width === 390 || width === 1440) await shot('chat-workspace')
    const chatComposer = page.getByTestId('chat-composer')
    const chatInput = chatComposer.getByRole('textbox', { name: 'Message' })
    await expect(chatInput).toHaveCSS('border-top-width', '0px')
    await expect(chatComposer).toHaveCSS('border-top-width', '1px')
    await expect(chatComposer.getByRole('button', { name: 'Dictate' })).toBeVisible()
    await chatInput.fill('What themes are emerging?')
    await expect(chatComposer.getByRole('button', { name: 'Send' })).toBeEnabled()
    await expect(chatComposer.getByRole('button', { name: 'Send' })).toHaveCSS('opacity', '1')
    await expect(chatComposer.getByRole('button', { name: 'Send' })).toHaveCSS('background-color', 'rgb(0, 100, 147)')
    await expect(chatComposer.getByRole('button', { name: 'Dictate' })).toHaveCSS('background-color', 'rgb(0, 100, 147)')
    if (width === 390 || width === 1440) await shot('chat-composer-ready')
    if (width < 1024) {
      await page.getByRole('button', { name: 'Show sessions' }).click()
      await expect(page.getByRole('dialog', { name: 'Chats' }).getByRole('button', { name: 'New chat' })).toBeVisible()
      await page.waitForTimeout(250)
      if (width === 390) await shot('chat-sessions-drawer')
      await page.getByRole('dialog', { name: 'Chats' }).getByRole('button', { name: 'Archive Week 1 feedback' }).click()
      await expect(page.getByRole('alertdialog', { name: 'Archive this Chat?' })).toBeVisible()
      if (width === 390) { await page.waitForTimeout(200); await shot('chat-archive-dialog') }
      await page.getByRole('button', { name: 'Cancel' }).click()
    }
    await page.getByRole('button', { name: /feedback source.*Change/i }).click()
    await expect(page.getByRole('dialog', { name: 'Choose chat context' })).toBeVisible()
    if (width === 390 || width === 1440) await shot('chat-context-dialog')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Open citation 1' }).click()
    await expect(page.getByText('The weekly instructions were clear.')).toBeVisible()
    if (width === 390 || width === 1440) await shot('chat-citation')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Chat instructions' }).click()
    await expect(page.getByRole('dialog', { name: 'Chat instructions' })).toBeVisible()
    if (width === 390 || width === 1440) { await page.waitForTimeout(200); await shot('chat-instructions-dialog') }
    await page.keyboard.press('Escape')

    await page.goto('/FeedbackAnalyzer.html')
    await expect(page.getByRole('heading', { name: 'Feedback Analyzer' })).toBeVisible()
    await assertInstructorHomeNavigationTheme()
    await expect.poll(() => page.getByRole('heading', { name: 'Feedback Analyzer' }).evaluate(element => getComputedStyle(element).fontSize)).toBe(width === 390 ? '28px' : '44px')
    await expect(page.getByRole('region', { name: 'Analysis metrics' })).toBeVisible()
    await expect(page.getByText('Traditional Analysis')).toBeVisible()
    await fit()
    if (width === 390 || width === 1440) await shot('analyzer-overview')
    await page.getByText('Traditional Analysis').click()
    await expect(page.getByRole('button', { name: 'About n-gram options' })).toBeVisible()
    await page.getByRole('button', { name: 'About n-gram options' }).click()
    await expect(page.getByText(/Unigrams count single words/)).toBeVisible()
    await fit()
    if (width === 390 || width === 1440) await shot('analyzer-traditional-info')
    await page.keyboard.press('Escape')
    await page.getByText('Traditional Analysis').click()
    await page.getByText('R1', { exact: true }).click()
    await expect(page.getByRole('region', { name: 'Transcript for response R1' })).toBeVisible()
    if (width === 390 || width === 1440) await shot('analyzer-response-detail')
  })
}

test('Wizard uses the same student composer with the Instructor Home theme', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/PromptDesigner.html')
  await page.getByRole('button', { name: 'Create new feedback' }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: /Weekly reflection/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const composer = page.getByRole('region', { name: 'AI collaboration' }).getByTestId('chat-composer')
  const input = composer.getByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' })
  await expect(input).toBeVisible()
  await expect(input).toHaveCSS('border-top-width', '0px')
  await expect(composer).toHaveCSS('border-top-width', '1px')
  await expect(composer.getByRole('button', { name: 'Dictate' })).toBeVisible()
  await input.fill('Make the opening question shorter.')
  await expect(composer.getByRole('button', { name: 'Send' })).toBeEnabled()
  await expect(composer.getByRole('button', { name: 'Send' })).toHaveCSS('opacity', '1')
  await expect(composer.getByRole('button', { name: 'Send' })).toHaveCSS('background-color', 'rgb(0, 100, 147)')
  await expect(composer.getByRole('button', { name: 'Dictate' })).toHaveCSS('background-color', 'rgb(0, 100, 147)')
  if (testInfo.project.name === 'chromium') {
    const desktop = join(process.cwd(), '.web-verify', 'screenshots', 'legacy-parity-wizard-composer-1440-chromium.png')
    await page.screenshot({ path: desktop, fullPage: true })
    await testInfo.attach('wizard-composer-desktop', { path: desktop, contentType: 'image/png' })
  }
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(composer.getByRole('button', { name: 'Dictate' })).toBeVisible()
  await expect(composer.getByRole('button', { name: 'Send' })).toBeVisible()
  await expect.poll(async () => {
    const box = await composer.boundingBox()
    return Boolean(box && box.x >= 0 && box.x + box.width <= 390)
  }).toBe(true)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (testInfo.project.name === 'chromium') {
    const mobile = join(process.cwd(), '.web-verify', 'screenshots', 'legacy-parity-wizard-composer-390-chromium.png')
    await page.screenshot({ path: mobile, fullPage: true })
    await testInfo.attach('wizard-composer-mobile', { path: mobile, contentType: 'image/png' })
  }
})

test('student preview runs and completes in its own page', async ({ page }, testInfo) => {
  const revisionId = '550e8400-e29b-41d4-a716-446655440040'
  const previewId = '550e8400-e29b-41d4-a716-446655440050'
  const date = '2026-09-28T12:00:00Z'
  const revision = {
    id: revisionId, question_set_id: '550e8400-e29b-41d4-a716-446655440060', revision_number: 1,
    source_draft_version: 1, content_hash: 'a'.repeat(64), preview_decision: null, created_at: date,
    body: { version: 1, title: 'Weekly reflection', intro: 'Tell us about this week.', scales: {},
      sections: [{ id: 'section-1', title: 'Learning', items: [{ id: 'question-1', prompt: 'What stood out this week?',
        wording: 'adaptive', response: { kind: 'text' }, reflection_goal: 'Understand a concrete moment.', coverage_targets: [],
        example_probes: [], max_additional_probes: 1 }] }] },
  }
  let answered = false
  let completed = false
  await page.route(`**/revisions/${revisionId}/preview/`, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers, json: { ...revision, preview_decision: completed ? 'completed' : null } })
    const messages = [
      { id: '1', role: 'assistant', content: revision.body.intro, item_id: null, created_at: date },
      { id: '2', role: 'assistant', content: 'What stood out this week?', item_id: 'question-1', created_at: date },
      ...(answered ? [
        { id: '3', role: 'student', content: 'The workshop helped.', item_id: 'question-1', created_at: date },
        { id: '4', role: 'assistant', content: 'Thank you for sharing your feedback.', item_id: null, created_at: date },
      ] : []),
    ]
    return route.fulfill({ headers, json: { preview_id: previewId, revision: { ...revision, preview_decision: completed ? 'completed' : null }, messages } })
  })
  await page.route(`**/previews/${previewId}/messages/`, async (route) => {
    answered = true
    await route.fulfill({ status: 201, headers, json: { id: '3', answered_count: 1 } })
  })
  await page.route(`**/revisions/${revisionId}/preview-decision/`, async (route) => {
    completed = true
    await route.fulfill({ headers, json: { ...revision, preview_decision: 'completed' } })
  })
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto(`/WizardPreview.html?revision=${revisionId}`)
  await expect(page.getByRole('heading', { name: 'Weekly reflection' })).toBeVisible()
  const composer = page.getByTestId('chat-composer')
  await expect(composer.getByRole('button', { name: 'Dictate' })).toBeVisible()
  await expect(composer.getByRole('textbox', { name: 'Preview answer' })).toHaveCSS('border-top-width', '0px')
  await page.getByRole('textbox', { name: 'Preview answer' }).fill('The workshop helped.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('The workshop helped.')).toBeVisible()
  await page.getByRole('button', { name: 'Complete preview' }).click()
  await expect(page.getByText(/Preview complete/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (testInfo.project.name === 'chromium') {
    const path = join(process.cwd(), '.web-verify', 'screenshots', 'legacy-parity-wizard-preview-390-chromium.png')
    await page.screenshot({ path, fullPage: true })
    await testInfo.attach('wizard-preview', { path, contentType: 'image/png' })
  }
})
