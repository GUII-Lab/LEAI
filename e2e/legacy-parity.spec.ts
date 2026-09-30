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
      if (width < 1024) {
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden()
      }
    }

    await page.goto('/PromptDesigner.html')
    await expect(page.getByRole('heading', { name: 'Prompt Designer' })).toBeVisible()
    await expect.poll(() => page.getByRole('heading', { name: 'Prompt Designer' })
      .evaluate(element => getComputedStyle(element).fontFamily)).toContain('Inter')
    await expect.poll(() => page.getByRole('heading', { name: 'Prompt Designer' }).evaluate(element => getComputedStyle(element).fontSize)).toBe(width === 390 ? '28px' : '44px')
    await assertInstructorHomeNavigationTheme()
    await fit()
    if (width === 390 || width === 1440) await shot('prompt-home')
    const createFeedback = page.getByRole('button', { name: 'Create new feedback' })
    await expect(createFeedback).toHaveCSS('background-image', 'linear-gradient(135deg, rgb(217, 119, 6), rgb(179, 97, 5))')
    await expect(createFeedback).toHaveCSS('color', 'rgb(255, 255, 255)')
    await createFeedback.click()
    await expect(page.getByRole('heading', { name: 'Who are you collecting feedback from?' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Individual feedback/ })).not.toBeChecked()
    await expect(page.getByRole('radio', { name: /Team feedback/ })).not.toBeChecked()
    const assertChoiceCards = async (name: string) => {
      const choices = page.getByRole('radiogroup', { name })
      const cards = choices.locator('label')
      const first = cards.first()
      await expect(first).toHaveCSS('padding-top', '24px')
      await expect(first).toHaveCSS('border-top-width', '2px')
      await expect(first.locator('[aria-hidden="true"]')).toHaveCSS('width', '42px')
      await expect(first.locator('[id$="-description"]')).toHaveCSS('font-size', '14px')
      await expect(first.getByRole('listitem')).toHaveCount(3)
      const boxes = await cards.evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, height: box.height }
      }))
      expect(boxes.every(box => box.height >= 210)).toBe(true)
      if (width <= 900) expect(boxes[1].y).toBeGreaterThan(boxes[0].y)
      else { expect(Math.abs(boxes[1].y - boxes[0].y)).toBeLessThan(1); expect(boxes[1].x).toBeGreaterThan(boxes[0].x) }
    }
    await assertChoiceCards('Feedback audience')
    await expect(page.getByText('One name-hidden session is bound to one self-selected team', { exact: true })).toBeVisible()
    if (width === 390) {
      const steps = page.getByRole('list', { name: 'Feedback Builder steps' })
      for (const name of ['Audience', 'Format', 'Build', 'Preview', 'Publish']) await expect(steps.getByText(name, { exact: true })).toBeVisible()
      const first = await steps.locator('li').first().boundingBox(), fourth = await steps.locator('li').nth(3).boundingBox()
      expect(Boolean(first && fourth && fourth.y > first.y)).toBe(true)
      const label = await steps.locator('li[aria-current="step"] > span').last().boundingBox()
      const nextNumber = await steps.locator('li').nth(1).locator('span').first().boundingBox()
      expect(Boolean(label && nextNumber && label.x + label.width <= nextNumber.x)).toBe(true)
    }
    await page.waitForTimeout(250)
    await fit()
    if (width === 390 || width === 1440) await shot('prompt-audience')
    await page.getByText('Individual feedback', { exact: true }).click()
    await expect(page.getByRole('heading', { name: 'How should the conversation work?' })).toBeVisible()
    await assertChoiceCards('Feedback format')
    await expect(page.getByRole('radio', { name: 'Guided feedback', exact: true })).not.toBeChecked()
    await expect(page.getByRole('radio', { name: 'Open conversation', exact: true })).not.toBeChecked()
    await page.waitForTimeout(250)
    await fit()
    if (width === 390 || width === 1440) await shot('prompt-format')
    await page.getByText('Guided feedback', { exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Choose a starting point' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCSS('background-color', 'rgb(0, 127, 131)')
    if (width === 390 || width === 1440) await shot('prompt-starting-point')
    await page.getByRole('button', { name: 'Close builder' }).click()
    await expect(page.getByRole('alertdialog', { name: 'Leave the Builder?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save and close' })).toHaveCSS('background-color', 'rgb(0, 127, 131)')
    if (width === 390 || width === 1440) { await page.waitForTimeout(200); await shot('prompt-close-dialog') }
    await page.getByRole('button', { name: 'Keep editing' }).click()

    await page.goto('/FeedbackChat.html')
    await expect(page.getByRole('heading', { name: 'Feedback Chat' })).toBeVisible()
    await expect.poll(() => page.getByRole('heading', { name: 'Feedback Chat' })
      .evaluate(element => getComputedStyle(element).fontFamily)).toContain('Inter')
    await expect.poll(() => page.getByRole('heading', { name: 'Feedback Chat' }).evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(width === 390 ? 18.35 : 23.95)
    await expect.poll(() => page.getByRole('heading', { name: 'Feedback Chat' }).evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(width === 390 ? 18.45 : 24.05)
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
    if (width < 768) {
      await page.getByRole('button', { name: 'Show sessions' }).click()
      await expect(page.getByRole('dialog', { name: 'Chats' }).getByRole('button', { name: 'New chat' })).toBeVisible()
      await page.waitForTimeout(250)
      if (width === 390) await shot('chat-sessions-drawer')
      await page.getByRole('dialog', { name: 'Chats' }).getByRole('button', { name: 'Archive Week 1 feedback' }).click()
      await expect(page.getByRole('alertdialog', { name: 'Archive this Chat?' })).toBeVisible()
      if (width === 390) { await page.waitForTimeout(200); await shot('chat-archive-dialog') }
      await page.getByRole('button', { name: 'Cancel' }).click()
    } else if (width < 1024) {
      await expect(page.getByRole('button', { name: 'Show sessions' })).toBeHidden()
      await expect(page.getByRole('region', { name: 'Feedback Chat workspace' }).getByRole('region', { name: 'Chat sessions' }).getByRole('button', { name: 'New chat' })).toBeVisible()
    }
    await page.getByRole('button', { name: /feedback source.*Change/i }).click()
    await expect(page.getByRole('dialog', { name: 'Choose chat context' })).toBeVisible()
    if (width === 390 || width === 1440) await shot('chat-context-dialog')
    await page.keyboard.press('Escape')
    const citation = page.getByRole('button', { name: 'Open citation 1' })
    await expect(citation).toHaveText('1')
    await expect(citation).toHaveCSS('height', '16px')
    await expect(citation).toHaveCSS('border-radius', '3px')
    await citation.click()
    const citationPopover = page.getByRole('dialog', { name: 'Source 1' })
    await expect(citationPopover).toBeVisible()
    await expect(citationPopover).toHaveCSS('opacity', '1')
    await expect(page.getByText('The weekly instructions were clear.')).toBeVisible()
    if (width === 390 || width === 1440) {
      await page.waitForTimeout(250)
      const path = join(directory, `legacy-parity-chat-citation-${width}-${testInfo.project.name}.png`)
      await page.screenshot({ path })
      await testInfo.attach('chat-citation-popover', { path, contentType: 'image/png' })
    }
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Chat instructions' }).click()
    await expect(page.getByRole('dialog', { name: 'Chat instructions' })).toBeVisible()
    if (width === 390 || width === 1440) { await page.waitForTimeout(200); await shot('chat-instructions-dialog') }
    await page.keyboard.press('Escape')

    await page.goto('/FeedbackAnalyzer.html')
    await expect(page.getByRole('heading', { name: 'Feedback Analyzer' })).toBeVisible()
    await expect.poll(() => page.getByRole('heading', { name: 'Feedback Analyzer' })
      .evaluate(element => getComputedStyle(element).fontFamily)).toContain('Inter')
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

test('Feedback Chat keeps the compact old QA heading and viewport-filling workspace', async ({ page }) => {
  for (const width of [390, 820, 1022, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/FeedbackChat.html')
    const title = page.getByRole('heading', { name: 'Feedback Chat', exact: true })
    await expect(title).toBeVisible()
    const expectedSize = width < 768 ? 18.4 : 24
    await expect.poll(() => title.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)))
      .toBeGreaterThanOrEqual(expectedSize - 0.5)
    await expect.poll(() => title.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)))
      .toBeLessThanOrEqual(expectedSize + 0.5)
    const workspace = page.getByRole('region', { name: 'Feedback Chat workspace' })
    await expect(workspace).toBeVisible()
    await expect.poll(async () => {
      const bounds = await workspace.boundingBox()
      return bounds ? Math.round(bounds.x) : -1
    }).toBe(width >= 1024 ? 220 : 0)
    await expect.poll(async () => {
      const bounds = await workspace.boundingBox()
      return bounds ? Math.round(bounds.x + bounds.width) : -1
    }).toBe(width)
    await expect.poll(async () => {
      const bounds = await workspace.boundingBox()
      return bounds ? Math.round(bounds.y + bounds.height) : -1
    }).toBe(900)
  }
})

test('Feedback Analyzer keeps the old QA content width and response expansion control', async ({ page }) => {
  for (const [width, expectedLeft] of [[390, 16], [820, 20], [1022, 32], [1440, 312]]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/FeedbackAnalyzer.html')
    const heading = page.getByRole('heading', { name: 'Feedback Analyzer' })
    await expect(heading).toBeVisible()
    await expect.poll(async () => Math.round((await heading.boundingBox())?.x ?? -1)).toBe(expectedLeft)
  }
  const expandAll = page.getByRole('button', { name: 'Expand All' })
  await expect(expandAll).toBeVisible()
  await expandAll.click()
  await expect(page.getByRole('region', { name: 'Transcript for response R1' })).toBeVisible()
  await page.getByRole('button', { name: 'Collapse All' }).click()
  await expect(page.getByRole('region', { name: 'Transcript for response R1' })).toBeHidden()
})

test('Wizard uses the shared student composer with the V12 Wizard theme', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/PromptDesigner.html')
  await page.getByRole('button', { name: 'Create new feedback' }).click()
  await page.getByText('Individual feedback', { exact: true }).click()
  await page.getByText('Guided feedback', { exact: true }).click()
  await page.getByRole('button', { name: /Weekly reflection/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Feedback title' })).toBeVisible()
  await expect(page.getByText('Individual · Guided')).toBeVisible()
  await page.getByRole('button', { name: 'Section 1 actions' }).click()
  await expect(page.getByRole('button', { name: 'Move up' })).toBeDisabled()
  await page.keyboard.press('Escape')
  const composer = page.getByRole('region', { name: 'AI collaboration' }).getByTestId('chat-composer')
  const input = composer.getByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' })
  await expect(input).toBeVisible()
  await expect(input).toHaveCSS('border-top-width', '0px')
  await expect(composer).toHaveCSS('border-top-width', '1px')
  await expect(composer.getByRole('button', { name: 'Dictate' })).toBeVisible()
  await input.fill('Make the opening question shorter.')
  await expect(composer.getByRole('button', { name: 'Send' })).toBeEnabled()
  await expect(composer.getByRole('button', { name: 'Send' })).toHaveCSS('opacity', '1')
  await expect(composer.getByRole('button', { name: 'Send' })).toHaveCSS('background-color', 'rgb(0, 127, 131)')
  await expect(composer.getByRole('button', { name: 'Dictate' })).toHaveCSS('background-color', 'rgb(0, 127, 131)')
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

test('V12 preview keeps switch thumbs inside the track and warns only on the first skip', async ({ page }, testInfo) => {
  const revision = { id: '550e8400-e29b-41d4-a716-446655440070', question_set_id: wizardDraftId,
    revision_number: 1, source_draft_version: 1, content_hash: 'a'.repeat(64), body: wizardDraft.body,
    preview_decision: null, created_at: '2026-09-29T12:00:00Z' }
  let decisions = 0
  await page.route('**/freeze/', route => route.fulfill({ headers, json: { revision } }))
  await page.route('**/preview-decision/', route => {
    decisions += 1
    return route.fulfill({ headers, json: { ...revision, preview_decision: 'skipped' } })
  })
  await page.goto('/PromptDesigner.html')
  await page.getByRole('button', { name: 'Create new feedback' }).click()
  await page.getByText('Individual feedback', { exact: true }).click()
  await page.getByText('Guided feedback', { exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Generate preview' }).click()
  await expect(page.getByRole('heading', { name: 'Preview this exact version' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Preview this exact version' })).toHaveCSS('font-size', '32px')
  await expect(page.getByRole('button', { name: /Open student preview/ })).toHaveCSS('color', 'rgb(38, 54, 58)')
  const certificate = page.getByRole('switch', { name: 'Completion certificate', exact: true })
  await expect(certificate.locator('..').locator('span').first()).toHaveCSS('font-size', '14px')
  const thumb = certificate.locator('[data-slot="switch-thumb"]')
  const assertThumbFits = async () => expect.poll(async () => {
    const track = await certificate.boundingBox(), knob = await thumb.boundingBox()
    return Boolean(track && knob && knob.x >= track.x && knob.x + knob.width <= track.x + track.width)
  }).toBe(true)
  await expect(certificate).toBeChecked()
  await assertThumbFits()
  await certificate.click()
  await expect(certificate).not.toBeChecked()
  await assertThumbFits()
  if (testInfo.project.name === 'webkit') {
    await page.keyboard.press('Alt+Shift+Tab')
    await page.keyboard.press('Alt+Tab')
  }
  await expect(certificate).toBeFocused()
  await page.keyboard.press('Space')
  await expect(certificate).toBeChecked()
  await assertThumbFits()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  const warning = page.getByRole('alertdialog', { name: 'Skip the student preview?' })
  await expect(warning).toBeVisible()
  await expect(warning.getByRole('heading', { name: 'Skip the student preview?' })).toHaveCSS('font-size', '23px')
  expect(decisions).toBe(0)
  await warning.getByRole('button', { name: 'Keep previewing' }).click()
  await expect(warning).toBeHidden()
  await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await warning.getByRole('button', { name: 'Skip preview', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Publish this feedback' })).toBeVisible()
  expect(decisions).toBe(1)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Generate preview' }).click()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Publish this feedback' })).toBeVisible()
  await expect(warning).toBeHidden()
  expect(decisions).toBe(2)
})
