import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getEnvironment } from '@/config/environment'
import { createStudentApi } from '@/api/student'
import { ApiFailure } from '@/api/contracts/errors'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StudentSurveyPage } from './StudentSurveyPage'

const environment = getEnvironment({})
const surveyId = '550e8400-e29b-41d4-a716-446655440010'
const sessionId = '550e8400-e29b-41d4-a716-446655440011'
const token = 'a'.repeat(64)
const researcherToken = 'researcher-session-token'
const survey = { survey_id: surveyId, label: 'Ulia reflection', intro: 'Welcome to reflection.', available: true,
  completion_certificate_enabled: false, completed_response_download_enabled: false }
const ratingPrompt = { item_id: 'P1', phase: 'rating' as const, text: 'I think about the work.', wording: 'exact' as const, choices: [
  { value: 1, label: 'Strongly disagree' }, { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' }, { value: 4, label: 'Agree' }, { value: 5, label: 'Strongly agree' },
] }
const reflectionPrompt = { item_id: 'P1', phase: 'reflection' as const, text: 'Why?', wording: 'adaptive' as const, choices: null }
const baseSession = { session_id: sessionId, survey_id: surveyId, turn_version: 1, status: 'active' as const, prompt: ratingPrompt,
  progress_label: 'Area 1 of 3 — Planning · Question 1 of 4', results: {}, answer_map: {}, messages: [] }
const api = { survey: vi.fn(), start: vi.fn(), session: vi.fn(), turn: vi.fn(), debugAccess: vi.fn(), debug: vi.fn(), finalize: vi.fn() } as unknown as ReturnType<typeof createStudentApi>
const browserStorage = new Map<string, string>()

function renderPage(verified = true, selectedEnvironment = environment) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<TooltipProvider><QueryClientProvider client={client}><StudentSurveyPage api={api} environment={selectedEnvironment} verified={verified} /></QueryClientProvider></TooltipProvider>)
}

async function acceptConsent(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('dialog', { name: 'Before you begin' })
  await user.click(within(dialog).getByRole('checkbox', { name: /I have read and agree/i }))
  await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
}

beforeEach(() => {
  sessionStorage.clear()
  browserStorage.clear()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => browserStorage.get(key) ?? null,
    setItem: (key: string, value: string) => browserStorage.set(key, String(value)),
    removeItem: (key: string) => browserStorage.delete(key),
    clear: () => browserStorage.clear(),
  } })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  window.history.replaceState({}, '', `/feedback.html?id=${surveyId}`)
  vi.mocked(api.survey).mockReset().mockResolvedValue(survey)
  vi.mocked(api.start).mockReset().mockResolvedValue({ ...baseSession, token })
  vi.mocked(api.session).mockReset().mockResolvedValue(baseSession)
  vi.mocked(api.turn).mockReset()
  vi.mocked(api.finalize).mockReset()
  vi.mocked(api.debugAccess).mockReset().mockResolvedValue({ enabled: false })
  vi.mocked(api.debug).mockReset().mockResolvedValue({
    session_id: sessionId, turn_version: 1,
    schema_state: { item_index: 0, phase: 'rating', results: {}, answer_map: {}, evidence_seen: {}, coverage_seen: {} },
    responses: [],
  })
})

function enableResearcherDebug() {
  sessionStorage.setItem('leai:local:instructor-token', researcherToken)
  vi.mocked(api.debugAccess).mockResolvedValue({ enabled: true })
}

it('uses Enter to send on desktop, shows the shared tooltip twice, and highlights new AI replies once', async () => {
  const active = { ...baseSession, prompt: { item_id: 'P1', phase: 'answer' as const,
    text: 'What information matters for your task?', wording: 'exact' as const, choices: null },
    messages: [{ id: 2, sequence: 2, role: 'assistant' as const, content: 'What information matters for your task?',
      attribution: { item_id: 'P1', phase: 'answer' } }] }
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  vi.mocked(api.session).mockResolvedValue(active)
  vi.mocked(api.turn).mockResolvedValue({ ...active, turn_version: 2, messages: [
    ...active.messages,
    { id: 3, sequence: 3, role: 'student' as const, content: 'First answer.', attribution: { item_id: 'P1' } },
    { id: 4, sequence: 4, role: 'assistant' as const, content: 'Thanks, tell me more.', attribution: { item_id: 'P1', phase: 'probe' } },
  ] })
  const user = userEvent.setup()
  renderPage()
  const message = await screen.findByRole('textbox', { name: 'Message' })

  await user.type(message, 'First answer.')
  await user.keyboard('{Enter}')
  await waitFor(() => expect(api.turn).toHaveBeenCalledTimes(1))
  expect(api.turn).toHaveBeenLastCalledWith(surveyId, sessionId, token, {
    expected_version: 1, item_id: 'P1', kind: 'text', text: 'First answer.',
  })
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Ctrl+Enter')
  const assistantMessages = screen.getByRole('log', { name: 'Conversation' }).querySelectorAll('[data-chat-role="assistant"]')
  expect(assistantMessages.item(assistantMessages.length - 1)).toHaveClass('student-assistant-arrival')

  await user.type(message, 'Second answer.')
  await user.keyboard('{Enter}')
  await waitFor(() => expect(api.turn).toHaveBeenCalledTimes(2))
  expect(window.localStorage.getItem('leai:student-enter-hint-count')).toBe('2')
  expect(await screen.findByRole('tooltip')).toHaveTextContent('⌘+Enter')
})

it('keeps modified Enter as a newline on desktop and makes mobile Enter a newline', async () => {
  const active = { ...baseSession, prompt: { item_id: 'P1', phase: 'answer' as const,
    text: 'What information matters for your task?', wording: 'exact' as const, choices: null }, messages: [] }
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  vi.mocked(api.session).mockResolvedValue(active)
  const user = userEvent.setup()
  renderPage()
  const message = await screen.findByRole('textbox', { name: 'Message' })
  await user.type(message, 'First line')
  await user.keyboard('{Control>}{Enter}{/Control}')
  expect(message).toHaveValue('First line\n')
  expect(api.turn).not.toHaveBeenCalled()

  await user.type(message, 'Second line')
  await user.keyboard('{Shift>}{Enter}{/Shift}')
  expect(message).toHaveValue('First line\nSecond line\n')
  await user.keyboard('{Meta>}{Enter}{/Meta}')
  expect(message).toHaveValue('First line\nSecond line\n\n')
  fireEvent.keyDown(message, { key: 'Enter', code: 'Enter', isComposing: true })
  expect(api.turn).not.toHaveBeenCalled()

  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  await user.keyboard('{Enter}')
  expect(message).toHaveValue('First line\nSecond line\n\n\n')
  expect(api.turn).not.toHaveBeenCalled()
})

it('keeps the original composer open after all questions so a student can revise before final download', async () => {
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  const ready = { ...baseSession, turn_version: 12, prompt: { phase: 'complete' as const },
    progress_label: 'Reflection complete', answer_map: { P1: [3] } }
  vi.mocked(api.session).mockResolvedValue(ready)
  vi.mocked(api.turn).mockResolvedValue({ ...ready, turn_version: 13,
    answer_map: { P1: [5] } })
  const user = userEvent.setup()
  renderPage()
  const message = await screen.findByRole('textbox', { name: 'Message' })
  expect(message).toBeEnabled()
  await user.type(message, 'Actually, change my P1 answer to this.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(api.turn).toHaveBeenCalledWith(surveyId, sessionId, token, {
    expected_version: 12, kind: 'text', text: 'Actually, change my P1 answer to this.',
  })
  expect(await screen.findByRole('textbox', { name: 'Message' })).toBeEnabled()
})

it('keeps the original consent dialog before starting and persists the optional research choice', async () => {
  const user = userEvent.setup()
  renderPage()
  const dialog = await screen.findByRole('dialog', { name: 'Before you begin' })
  expect(within(dialog).getByText(/^LEAI is an/)).toHaveTextContent('anonymous mid-course feedback tool')
  expect(screen.queryByRole('button', { name: 'Start reflection' })).not.toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(api.start).not.toHaveBeenCalled()
  await user.click(within(dialog).getByRole('checkbox', { name: /I have read and agree/i }))
  await user.click(within(dialog).getByRole('checkbox', { name: /Optional.*I also consent/i }))
  await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
  await waitFor(() => expect(api.start).toHaveBeenCalledWith(surveyId, { terms_consent: true, research_consent: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', expect.stringContaining('legal/terms.html'))
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', expect.stringContaining('legal/privacy.html'))
})

it('retains the original conversation footer and output controls when the survey enables them', async () => {
  vi.mocked(api.survey).mockResolvedValue({ ...survey, completion_certificate_enabled: true,
    completed_response_download_enabled: true })
  const user = userEvent.setup()
  renderPage()
  const dialog = await screen.findByRole('dialog', { name: 'Before you begin' })
  expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled()
  await acceptConsent(user)
  expect(await screen.findByText(/You can revise or add to any answer anytime/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save draft (.docx)' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Respond once to unlock your certificate' })).toBeDisabled()
})

it('uses the shared chat message and icon-send components without changing student turn behavior', async () => {
  vi.mocked(api.start).mockResolvedValue({ ...baseSession, token,
    prompt: { item_id: 'P1', phase: 'answer', text: 'What information matters?', wording: 'exact', choices: null },
  })
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)

  const transcript = screen.getByRole('log', { name: 'Conversation' })
  expect(transcript.querySelector('[data-chat-role="assistant"]')).toBeInTheDocument()
  const composer = screen.getByTestId('chat-composer')
  expect(within(composer).getByRole('textbox', { name: 'Message' })).toBeInTheDocument()
  expect(within(composer).getByRole('button', { name: 'Dictate' })).toBeInTheDocument()
  const sendButton = within(composer).getByRole('button', { name: 'Send' })
  expect(sendButton).toHaveAttribute('type', 'submit')
  expect(sendButton.querySelector('svg')).toBeInTheDocument()
  expect(sendButton).not.toHaveTextContent('Send')

  await user.type(within(composer).getByRole('textbox', { name: 'Message' }), 'A considered answer.')
  await user.click(sendButton)
  expect(api.turn).toHaveBeenCalledWith(surveyId, sessionId, token, {
    expected_version: 1, item_id: 'P1', kind: 'text', text: 'A considered answer.',
  })
})

it('auto-hides the header and reflection strip after the first student reply and lets students reveal them', async () => {
  const active = { ...baseSession, prompt: { item_id: 'P1', phase: 'answer' as const,
    text: 'What information matters for your task?', wording: 'exact' as const, choices: null },
    messages: [{ id: 2, sequence: 2, role: 'assistant' as const, content: 'What information matters for your task?',
      attribution: { item_id: 'P1', phase: 'answer' } }] }
  const answered = { ...active, turn_version: 2, messages: [
    ...active.messages,
    { id: 3, sequence: 3, role: 'student' as const, content: 'I share relevant context.', attribution: { item_id: 'P1' } },
    { id: 4, sequence: 4, role: 'assistant' as const, content: 'How do you choose it?', attribution: { item_id: 'P1', phase: 'probe' } },
  ] }
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  vi.mocked(api.survey).mockResolvedValue({ ...survey, completed_response_download_enabled: true })
  vi.mocked(api.session).mockResolvedValue(active)
  vi.mocked(api.turn).mockResolvedValue(answered)
  const user = userEvent.setup()
  renderPage()
  const header = await screen.findByRole('banner')
  expect(header).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Keep LEAI header visible' })).not.toBeInTheDocument()
  const message = await screen.findByRole('textbox', { name: 'Message' })
  await user.type(message, 'I share relevant context.')
  await user.click(screen.getByRole('button', { name: 'Send' }))

  const headerToggle = await screen.findByRole('button', { name: 'Keep LEAI header visible' })
  expect(headerToggle).toHaveAttribute('aria-expanded', 'false')
  expect(header).toHaveAttribute('aria-hidden', 'true')
  const reflectionToggle = screen.getByRole('button', { name: 'Keep reflection progress and downloads visible' })
  expect(reflectionToggle).toHaveAttribute('aria-expanded', 'false')
  expect(document.getElementById('reflection-downloads')).toHaveAttribute('aria-hidden', 'true')

  await user.click(headerToggle)
  expect(headerToggle).toHaveAttribute('aria-expanded', 'true')
  expect(header).toHaveAttribute('aria-hidden', 'false')
  await user.click(reflectionToggle)
  expect(reflectionToggle).toHaveAttribute('aria-expanded', 'true')
  expect(document.getElementById('reflection-downloads')).toHaveAttribute('aria-hidden', 'false')
})

it('shows a collapsible debug disclosure beneath the current assistant message, never in a side panel', async () => {
  enableResearcherDebug()
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)
  const assistant = screen.getByRole('log', { name: 'Conversation' }).querySelectorAll('[data-chat-role="assistant"]').item(0) as HTMLElement
  const disclosure = within(assistant).getByRole('button', { name: 'Show debug state' })
  expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  expect(document.getElementById(disclosure.getAttribute('aria-controls')!)).toHaveAttribute('hidden')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('Recorded schema state')).not.toBeInTheDocument()
  expect(api.debug).not.toHaveBeenCalled()
  await user.click(disclosure)
  expect(await within(assistant).findByText('Recorded schema state')).toBeInTheDocument()
  expect(within(assistant).getByRole('region', { name: 'Recorded debug state' })).not.toHaveAttribute('hidden')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(api.debugAccess).toHaveBeenCalledWith(surveyId)
  expect(api.debug).toHaveBeenCalledWith(surveyId, sessionId)
  expect(screen.getByText('rating', { selector: 'dd' })).toBeInTheDocument()
  await user.click(within(assistant).getByRole('button', { name: 'Hide debug state' }))
  expect(screen.queryByText('Recorded schema state')).not.toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /^Agree$/ })).toBeInTheDocument()
})

it('does not expose debug state to a student who only has the anonymous session capability', async () => {
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)
  expect(screen.queryByRole('button', { name: /debug state/i })).not.toBeInTheDocument()
  expect(api.debugAccess).toHaveBeenCalledWith(surveyId)
  expect(api.debug).not.toHaveBeenCalled()
})

it('does not expose debug controls in production', async () => {
  const production = { ...environment, name: 'production' as const }
  const user = userEvent.setup()
  renderPage(true, production)
  await acceptConsent(user)
  expect(screen.queryByRole('button', { name: /debug state/i })).not.toBeInTheDocument()
  expect(api.debug).not.toHaveBeenCalled()
})

it('does not show a nonexistent next question index after completion', async () => {
  enableResearcherDebug()
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  vi.mocked(api.session).mockResolvedValue({ ...baseSession, turn_version: 12, status: 'completed', prompt: { phase: 'complete' },
    results: { P1: { rating: null, status: 'answered', probes: 0 } } })
  vi.mocked(api.debug).mockResolvedValue({
    session_id: sessionId, turn_version: 12,
    schema_state: { item_index: 11, phase: 'complete',
      results: { P1: { rating: null, status: 'answered', probes: 0 } }, answer_map: {}, evidence_seen: { P1: true }, coverage_seen: {} },
    responses: [],
  })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Show debug state' }))
  expect(await screen.findByText('Recorded schema state')).toBeInTheDocument()
  expect(screen.getByText('Question index').parentElement).toHaveTextContent('Complete')
})

it('refreshes collected evidence and results after a student turn', async () => {
  enableResearcherDebug()
  vi.mocked(api.start).mockResolvedValue({ ...baseSession, token, prompt: reflectionPrompt })
  vi.mocked(api.turn).mockResolvedValue({ ...baseSession, turn_version: 2, prompt: { ...reflectionPrompt, phase: 'probe', text: 'How did you decide?' },
    results: { P1: { rating: null, status: 'active', probes: 1 } },
    messages: [
      { id: 1, sequence: 1, role: 'assistant', content: survey.intro, attribution: { phase: 'intro' } },
      { id: 2, sequence: 2, role: 'assistant', content: reflectionPrompt.text, attribution: { item_id: 'P1', phase: 'reflection' } },
      { id: 3, sequence: 3, role: 'student', content: 'I chose useful context.', attribution: { item_id: 'P1', phase: 'reflection' } },
      { id: 4, sequence: 4, role: 'assistant', content: 'How did you decide?', attribution: { item_id: 'P1', phase: 'probe' } },
    ],
  })
  vi.mocked(api.debug).mockResolvedValueOnce({
    session_id: sessionId, turn_version: 1,
    schema_state: { item_index: 0, phase: 'answer', results: {}, answer_map: {}, evidence_seen: {}, coverage_seen: {} }, responses: [],
  }).mockResolvedValueOnce({
    session_id: sessionId, turn_version: 2,
    schema_state: { item_index: 0, phase: 'probe', results: { P1: { rating: null, status: 'active', probes: 1 } },
      answer_map: {}, evidence_seen: { P1: true, P2: true }, coverage_seen: { P1: ['decision_process'] } },
    responses: [{ sequence: 3, item_id: 'P1', phase: 'answer', kind: 'text', content: 'I chose useful context.',
      evidence_for: ['P1', 'P2'], covered_targets: ['decision_process'], next_item_id: 'P1', next_phase: 'probe' }],
  })
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)
  await user.click(screen.getByRole('button', { name: 'Show debug state' }))
  expect(await screen.findByText('Recorded schema state')).toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: 'Message' }), 'I chose useful context.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByText('How did you decide?')).toBeInTheDocument()
  expect(await screen.findByText('Follow-up pending')).toBeInTheDocument()
  const assistants = screen.getByRole('log', { name: 'Conversation' }).querySelectorAll('[data-chat-role="assistant"]')
  expect(within(assistants.item(1) as HTMLElement).getByRole('button', { name: 'Hide debug state' })).toBeInTheDocument()
  expect(within(assistants.item(0) as HTMLElement).queryByRole('button', { name: /debug state/i })).not.toBeInTheDocument()
  expect(screen.getByText('P1 · answer → P1 probe')).toBeInTheDocument()
  expect(await screen.findByText(/Covered targets: decision_process/)).toBeInTheDocument()
  expect(screen.getByText('I chose useful context.', { selector: 'blockquote' })).toBeInTheDocument()
})

it('presents the public introduction and an exact Likert statement, then asks for reflection', async () => {
  vi.mocked(api.turn).mockResolvedValue({ ...baseSession, turn_version: 2, prompt: reflectionPrompt, results: { P1: { rating: 4, status: 'active', probes: 0 } } })
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByRole('dialog', { name: 'Before you begin' })).toBeInTheDocument()
  await acceptConsent(user)
  expect(await screen.findByText('I think about the work.')).toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'Agree' }))
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(api.turn).toHaveBeenCalledWith(surveyId, sessionId, token, { expected_version: 1, item_id: 'P1', kind: 'rating', value: 4 })
  expect(await screen.findByText('Why?')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument()
})

it('restores a session with its scoped capability after remount', async () => {
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  renderPage()
  expect(await screen.findByText('I think about the work.')).toBeInTheDocument()
  expect(api.start).not.toHaveBeenCalled()
  expect(api.session).toHaveBeenCalledWith(surveyId, sessionId, token)
})

it('restores a session from a copied fragment link without putting its capability in the request URL', async () => {
  window.history.replaceState({}, '', `/feedback.html?id=${surveyId}#session=${sessionId}&token=${token}`)
  renderPage()
  expect(await screen.findByText('I think about the work.')).toBeInTheDocument()
  expect(api.session).toHaveBeenCalledWith(surveyId, sessionId, token)
  expect(window.location.hash).toBe('')
  expect(sessionStorage.getItem(`leai:local:student:${surveyId}`)).toContain(sessionId)
})

it('copies an anonymous resume link with the capability in the fragment', async () => {
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)
  await user.click(screen.getByRole('button', { name: 'Copy resume link' }))
  const copied = new URL(await navigator.clipboard.readText())
  expect(copied.searchParams.get('id')).toBe(surveyId)
  expect(copied.hash).toContain(`session=${sessionId}`)
  expect(copied.hash).toContain(`token=${token}`)
  expect(copied.search).not.toContain(token)
})

it('shows prior-coverage confirmation separately from the exact next question', async () => {
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  vi.mocked(api.session).mockResolvedValue({
    ...baseSession,
    prompt: { ...ratingPrompt, item_id: 'P2', text: 'I consider what information the AI needs.',
      context_note: 'You may have touched on this earlier. Please confirm or clarify your answer here.' },
  })
  renderPage()
  expect(await screen.findByText('I consider what information the AI needs.')).toBeInTheDocument()
  expect(screen.getByText(/Please confirm or clarify/)).toBeInTheDocument()
})

it('never starts a session when the environment is read-only', async () => {
  renderPage(false)
  const dialog = await screen.findByRole('dialog', { name: 'Before you begin' })
  expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(api.start).not.toHaveBeenCalled()
})

it('keeps the response for retry after a transient assessment failure', async () => {
  vi.mocked(api.start).mockResolvedValue({ ...baseSession, token, prompt: reflectionPrompt })
  vi.mocked(api.turn).mockRejectedValueOnce(new Error('assessment unavailable')).mockResolvedValueOnce({
    ...baseSession, turn_version: 2, prompt: { phase: 'complete' }, status: 'completed',
    progress_label: 'Reflection complete',
    results: { P1: { rating: null, status: 'answered', probes: 0 } },
  })
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)
  await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'I planned before asking.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Your answer was not sent')
  expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('I planned before asking.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(screen.getAllByText('Reflection complete').length).toBeGreaterThan(0))
  expect(api.turn).toHaveBeenCalledTimes(2)
})

it('allows a fresh start when a stored session can no longer be restored', async () => {
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  vi.mocked(api.session).mockRejectedValue(new ApiFailure({ kind: 'not_found', status: 404, retryable: false }))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Start a new reflection' }))
  expect(sessionStorage.getItem(`leai:local:student:${surveyId}`)).toBeNull()
  expect(await screen.findByRole('dialog', { name: 'Before you begin' })).toBeInTheDocument()
})

it('offers to reload the latest question after a concurrent-turn conflict', async () => {
  vi.mocked(api.start).mockResolvedValue({ ...baseSession, token, prompt: reflectionPrompt })
  vi.mocked(api.turn).mockRejectedValue(new ApiFailure({ kind: 'conflict', status: 409, retryable: false }))
  vi.mocked(api.session).mockResolvedValueOnce(baseSession).mockResolvedValueOnce({
    ...baseSession, turn_version: 2, prompt: { ...reflectionPrompt, item_id: 'P2', text: 'Next question' },
  })
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)
  await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'A response')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('changed in another tab')
  await user.click(screen.getByRole('button', { name: 'Load latest question' }))
  expect(await screen.findByText('Next question')).toBeInTheDocument()
})

it('keeps structured reflection inside the student conversation instead of a question form', async () => {
  vi.mocked(api.start).mockResolvedValue({ ...baseSession, token,
    prompt: reflectionPrompt,
    messages: [
      { id: 1, sequence: 1, role: 'assistant', content: survey.intro, attribution: { phase: 'intro' } },
      { id: 2, sequence: 2, role: 'assistant', content: reflectionPrompt.text, attribution: { item_id: 'P1', phase: 'reflection' } },
    ],
  })
  vi.mocked(api.turn).mockResolvedValue({ ...baseSession, turn_version: 2,
    prompt: { ...reflectionPrompt, phase: 'probe', text: 'How did you decide?' },
    messages: [
      { id: 1, sequence: 1, role: 'assistant', content: survey.intro, attribution: { phase: 'intro' } },
      { id: 2, sequence: 2, role: 'assistant', content: reflectionPrompt.text, attribution: { item_id: 'P1', phase: 'reflection' } },
      { id: 3, sequence: 3, role: 'student', content: 'I planned before asking.', attribution: { item_id: 'P1', phase: 'reflection' } },
      { id: 4, sequence: 4, role: 'assistant', content: 'How did you decide?', attribution: { item_id: 'P1', phase: 'probe' } },
    ],
  })
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)
  const conversation = screen.getByRole('log', { name: 'Conversation' })
  expect(conversation).toHaveTextContent('Welcome to reflection.')
  expect(conversation).toHaveTextContent('Why?')
  expect(conversation.querySelectorAll('[data-chat-role="assistant"]')).toHaveLength(1)
  expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: 'Message' }), 'I planned before asking.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByText('How did you decide?')).toBeInTheDocument()
  expect(conversation).toHaveTextContent('I planned before asking.')
  expect(conversation).toHaveTextContent('How did you decide?')
  expect(screen.queryByText('Your reflection')).not.toBeInTheDocument()
})
