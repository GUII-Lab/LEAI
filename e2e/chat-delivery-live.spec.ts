import fs from 'node:fs'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const base = process.env.LEAI_CHAT_VERIFY_BASE
const credentialFile = process.env.LEAI_CHAT_VERIFY_FIXTURE
test.skip(!base || !credentialFile, 'Requires a disposable isolated or QA chat fixture')
test.setTimeout(120_000)
test.describe.configure({ mode: 'serial' })
let instructorCookies: Awaited<ReturnType<BrowserContext['cookies']>> | undefined

async function dictationDouble(page: Page) {
  // Browser SpeechRecognition plumbing, not microphone/acoustic acceptance.
  await page.addInitScript(() => {
    class Recognition {
      continuous = true; interimResults = true; lang = ''
      onresult: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      start() { (window as unknown as { chatRecognition: Recognition }).chatRecognition = this }
      stop() { this.onend?.() }
    }
    Object.assign(window, { SpeechRecognition: Recognition })
  })
}
async function instructor(page: Page) {
  const credentials = JSON.parse(fs.readFileSync(credentialFile!, 'utf8'))
  if (instructorCookies) {
    await page.context().addCookies(instructorCookies)
    await page.goto(`${base}/InstructorHome.html`)
  } else {
    await page.goto(`${base}/InstructorLogin.html`)
    await page.getByLabel('Email', { exact: true }).fill(credentials.email)
    await page.getByLabel('Password', { exact: true }).fill(credentials.password)
    const response = page.waitForResponse(reply => reply.url().includes('/instructor_sessions/') && reply.request().method() === 'POST', { timeout: 30_000 })
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    expect((await response).status()).toBe(201)
    await page.waitForURL(/InstructorHome/)
    instructorCookies = await page.context().cookies()
  }
  await page.getByRole('link', { name: 'Open QA Conversational Likert Validation', exact: true }).click()
}
async function exercise(page: Page, endpoint: RegExp, text: string, testInfo: import('@playwright/test').TestInfo) {
  const input = page.getByRole('textbox', { name: /^(Message|Ask LEAI to edit this feedback draft)$/ })
  const log = page.getByRole('log', { name: 'Conversation' })
  const previousAssistantCount = await log.locator('[data-chat-role="assistant"]').count()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let requests = 0
  let responseStatus: number | undefined
  await page.route(endpoint, async route => {
    if (route.request().method() !== 'POST') return route.continue()
    requests += 1
    const response = await route.fetch({ timeout: 90_000 })
    responseStatus = response.status()
    await gate
    await route.fulfill({ response })
  })
  await input.fill(text)
  await page.getByRole('button', { name: 'Dictate', exact: true }).click()
  await expect(input).toBeFocused()
  await input.press('Enter')
  try {
    await expect(log.getByText(text, { exact: true })).toBeVisible()
    await expect(page.getByRole('status', { name: 'LEAI is responding' })).toBeVisible()
    await expect(input).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Stop dictation' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Sending message' })).toBeDisabled()
    await expect(input).toHaveValue('')
    await input.fill('Next draft')
    await input.press('Control+Enter')
    await input.press('Enter')
    await expect(input).toHaveValue('Next draft\n')
    await page.evaluate(() => {
      const instance = (window as unknown as { chatRecognition: { onresult: (event: unknown) => void } }).chatRecognition
      instance.onresult({ results: [{ isFinal: true, 0: { transcript: 'spoken next detail' } }] })
    })
    await expect(input).toHaveValue('Next draft spoken next detail')
    await expect.poll(() => requests).toBe(1)
    await page.screenshot({ path: testInfo.outputPath('waiting-editable-dictation.png'), fullPage: true })
  } finally { release() }
  await expect.poll(() => responseStatus !== undefined && [200, 202].includes(responseStatus), { timeout: 90_000 }).toBe(true)
  await expect(page.getByRole('status', { name: 'LEAI is responding' })).toHaveCount(0, { timeout: 90_000 })
  await expect.poll(() => log.locator('[data-chat-role="assistant"]').count()).toBeGreaterThan(previousAssistantCount)
  await expect(log.locator('[data-chat-role="assistant"]').last().locator('p').first()).toBeInViewport()
  await expect(input).toHaveValue('Next draft spoken next detail')
  await expect(page.getByRole('button', { name: 'Stop dictation' })).toHaveAttribute('aria-pressed', 'true')
  await expect(log.getByText(text, { exact: true })).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('reply-keeps-next-draft.png'), fullPage: true })
  await page.unroute(endpoint)
  await page.getByRole('button', { name: 'Stop dictation' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await input.fill('Mobile draft')
  await input.press('Enter')
  await expect(input).toHaveValue('Mobile draft\n')
  await page.screenshot({ path: testInfo.outputPath('mobile-newline.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.route(endpoint, route => route.request().method() === 'POST' ? route.abort('failed') : route.continue())
  await input.fill('Delivery failure example')
  await input.press('Enter')
  await expect(log.getByText('Delivery failure example', { exact: true })).toBeVisible()
  await expect(log.getByRole('alert')).toHaveCount(1)
  const retry = log.getByRole('button', { name: 'Retry', exact: true })
  await expect(retry).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(1)
  await expect(input).toBeEnabled()
  await input.fill('Draft after network failure')
  await expect(input).toHaveValue('Draft after network failure')
  await page.screenshot({ path: testInfo.outputPath('failed-delivery-preserves-draft.png'), fullPage: true })
  await page.unroute(endpoint)
  const retryRequest = page.waitForResponse(response => endpoint.test(response.url()) && response.request().method() === 'POST', { timeout: 90_000 })
  await retry.click()
  expect((await retryRequest).status()).toBe(endpoint.source.includes('sessions') ? 200 : 202)
  await expect(retry).toHaveCount(0)
  await expect(page.getByRole('status', { name: 'LEAI is responding' })).toHaveCount(0, { timeout: 90_000 })
  await expect(log.getByText('Delivery failure example', { exact: true })).toHaveCount(1)
  await expect(input).toHaveValue('Draft after network failure')
  await page.screenshot({ path: testInfo.outputPath('retry-keeps-next-draft.png'), fullPage: true })
}

test('student send is immediate, editable and dictation survives a real AI response', async ({ page }, testInfo) => {
  const credentials = JSON.parse(fs.readFileSync(credentialFile!, 'utf8'))
  await dictationDouble(page)
  await page.goto(`${base}/feedback.html?id=${credentials.survey_id}`)
  await page.getByRole('checkbox', { name: /I have read and agree/i }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await exercise(page, /\/sessions\/[^/]+\/turns\/$/, 'I would say four because I choose the task goal and relevant examples, and leave out private information.', testInfo)
})

test('Feedback Chat retains the next draft through a real durable AI job', async ({ page }, testInfo) => {
  await dictationDouble(page)
  await instructor(page)
  await page.goto(`${base}/FeedbackChat.html`)
  await page.getByRole('button', { name: 'New chat', exact: true }).first().click()
  await page.getByRole('button', { name: /Choose chat context/ }).click()
  const dialog = page.getByRole('dialog', { name: /Chat context/i })
  await dialog.getByRole('checkbox').first().check()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await exercise(page, /\/analysis\/chats\/[^/]+\/turns\/$/, 'Summarize the synthetic students’ feedback in one paragraph.', testInfo)
})

test('Wizard instructions are immediate and retain the next draft through a real AI edit', async ({ page }, testInfo) => {
  await dictationDouble(page)
  await instructor(page)
  await page.goto(`${base}/PromptDesigner.html`)
  await page.getByRole('button', { name: 'Create new feedback' }).click()
  await page.getByRole('radio', { name: /Individual feedback/ }).locator('..').click()
  await page.getByRole('radio', { name: /Guided feedback/ }).locator('..').click()
  await page.getByRole('tab', { name: 'Start from scratch' }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await exercise(page, /\/question-sets\/[^/]+\/ai-runs\/$/, 'Make the introduction shorter without changing any questions.', testInfo)
})
