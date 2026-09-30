import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getEnvironment } from '@/config/environment'
import { createStudentApi, type StudentSession } from '@/api/student'
import { ApiFailure } from '@/api/contracts/errors'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StudentSurveyPage } from './StudentSurveyPage'

const environment = getEnvironment({})
const surveyId = '550e8400-e29b-41d4-a716-446655440010'
const sessionId = '550e8400-e29b-41d4-a716-446655440011'
const token = 'a'.repeat(64)
const researcherToken = 'researcher-session-token'
const survey = { survey_id: surveyId, label: 'Ulia reflection', intro: 'Welcome to reflection.', available: true,
  anonymous_matching_enabled: false, completion_certificate_enabled: false, completed_response_download_enabled: false }
const ratingPrompt = { item_id: 'P1', phase: 'rating' as const, text: 'I think about the work.', wording: 'exact' as const, choices: [
  { value: 1, label: 'Strongly disagree' }, { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' }, { value: 4, label: 'Agree' }, { value: 5, label: 'Strongly agree' },
] }
const reflectionPrompt = { item_id: 'P1', phase: 'reflection' as const, text: 'Why?', wording: 'adaptive' as const, choices: null }
const baseSession = { session_id: sessionId, survey_id: surveyId, turn_version: 1, status: 'active' as const, prompt: ratingPrompt,
  progress_label: 'Area 1 of 3 — Planning · Question 1 of 4', results: {}, answer_map: {}, messages: [] }
const api = { survey: vi.fn(), start: vi.fn(), session: vi.fn(), turn: vi.fn(), matchingSignals: vi.fn(), debugAccess: vi.fn(), debug: vi.fn(), finalize: vi.fn(), responsePdf: vi.fn() } as unknown as ReturnType<typeof createStudentApi>
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
  vi.mocked(api.responsePdf).mockReset().mockResolvedValue(new Blob(['%PDF-test'], { type: 'application/pdf' }))
  vi.mocked(api.matchingSignals).mockReset().mockResolvedValue({ accepted: true })
  Object.defineProperty(window, 'FingerprintJS', { configurable: true, value: undefined })
  vi.mocked(api.debugAccess).mockReset().mockResolvedValue({ enabled: false })
  vi.mocked(api.debug).mockReset().mockResolvedValue({
    session_id: sessionId, turn_version: 1,
    schema_state: { item_index: 0, phase: 'rating', results: {}, answer_map: {}, evidence_seen: {}, coverage_seen: {} },
    responses: [],
  })
})

it('retries only the failed submission with its stable ID and leaves the next draft untouched', async () => {
  const user = userEvent.setup()
  vi.mocked(api.turn).mockRejectedValueOnce(new Error('Lost connection')).mockResolvedValueOnce({
    ...baseSession, turn_version: 2, messages: [
      { id: 1, sequence: 1, role: 'student', content: 'Original answer', attribution: {} },
      { id: 2, sequence: 2, role: 'assistant', content: 'Next question', attribution: {} },
    ],
  })
  renderPage()
  await acceptConsent(user)
  const input = screen.getByRole('textbox', { name: 'Message' })
  await user.type(input, 'Original answer')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  const retry = await screen.findByRole('button', { name: 'Retry' })
  const log = screen.getByRole('log')
  expect(log).toContainElement(retry)
  expect(screen.getAllByRole('alert')).toHaveLength(1)
  await user.type(input, 'Next draft')
  await user.click(retry)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument())
  const first = vi.mocked(api.turn).mock.calls[0][3]
  expect(first).toMatchObject({ text: 'Original answer', expected_version: 1, request_id: expect.any(String) })
  expect(vi.mocked(api.turn).mock.calls[1][3]).toEqual(first)
  expect(input).toHaveValue('Next draft')
  expect(within(log).getAllByText('Original answer')).toHaveLength(1)
})

it('reconciles a lost response without resending an already committed answer', async () => {
  const user = userEvent.setup()
  vi.mocked(api.turn).mockRejectedValueOnce(new Error('Lost response'))
  vi.mocked(api.session).mockResolvedValue({ ...baseSession, turn_version: 2, messages: [
    { id: 1, sequence: 1, role: 'student', content: 'Saved answer', attribution: {} },
    { id: 2, sequence: 2, role: 'assistant', content: 'Next question', attribution: {} },
  ] })
  renderPage()
  await acceptConsent(user)
  await user.type(screen.getByRole('textbox'), 'Saved answer')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await user.click(await screen.findByRole('button', { name: 'Retry' }))
  await screen.findByText('Next question')
  expect(api.turn).toHaveBeenCalledTimes(1)
  expect(within(screen.getByRole('log')).getAllByText('Saved answer')).toHaveLength(1)
})

function enableResearcherDebug() {
  sessionStorage.setItem('leai:local:instructor-token', researcherToken)
  vi.mocked(api.debugAccess).mockResolvedValue({ enabled: true })
}

function deferredTurn() {
  let resolve!: (session: StudentSession) => void
  let reject!: (error: Error) => void
  const promise = new Promise<StudentSession>((yes, no) => { resolve = yes; reject = no })
  vi.mocked(api.turn).mockReturnValueOnce(promise)
  return { resolve, reject }
}

it('shows the submitted answer and LEAI thinking before delivery, preserving the next draft on success', async () => {
  const pending = deferredTurn()
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)
  const input = screen.getByRole('textbox', { name: 'Message' })
  await user.type(input, 'First answer.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  const log = screen.getByRole('log', { name: 'Conversation' })
  expect(within(log).getByText('First answer.')).toBeVisible()
  const thinking = within(log).getByRole('status', { name: 'LEAI is responding' })
  expect(thinking).toBeVisible()
  expect(thinking.closest('[data-chat-role="assistant"]')).toHaveTextContent('LEAI')
  expect(thinking.querySelectorAll('.chat-thinking-dots > span')).toHaveLength(3)
  expect(input).toHaveValue('')
  expect(input).toBeEnabled()
  await user.type(input, 'Next draft.')
  expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled()
  await user.keyboard('{Enter}')
  fireEvent.submit(input.closest('form')!)
  expect(api.turn).toHaveBeenCalledTimes(1)
  await act(async () => pending.resolve({ ...baseSession, turn_version: 2, messages: [
    { id: 3, sequence: 3, role: 'student', content: 'First answer.', attribution: {} },
    { id: 4, sequence: 4, role: 'assistant', content: 'Next question.', attribution: {} },
  ] }))
  expect(input).toHaveValue('Next draft.')
  expect(within(log).getAllByText('First answer.')).toHaveLength(1)
  expect(within(log).queryByRole('status')).not.toBeInTheDocument()
})

it.each(['delivery', 'conflict'])('retains the failed answer in the transcript and the new draft after %s failure', async (kind) => {
  const pending = deferredTurn()
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)
  const input = screen.getByRole('textbox', { name: 'Message' })
  await user.type(input, 'Unconfirmed answer.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(input).toHaveValue('')
  await user.type(input, 'Keep this next draft.')
  await act(async () => pending.reject(kind === 'conflict'
    ? new ApiFailure({ kind: 'conflict', status: 409, retryable: false }) : new Error('Offline')))
  const log = screen.getByRole('log', { name: 'Conversation' })
  const bubble = within(log).getByText('Unconfirmed answer.').closest('[data-chat-role="user"]') as HTMLElement
  expect(bubble).toHaveTextContent(kind === 'conflict' ? 'Conversation changed' : 'Connection lost')
  expect(input).toHaveValue('Keep this next draft.')
  expect(screen.getByRole('alert')).not.toHaveTextContent('was not sent')
  expect(within(bubble).getByRole('button', { name: kind === 'conflict' ? 'Refresh' : 'Retry' })).toBeEnabled()
  expect(within(log).queryByRole('status')).not.toBeInTheDocument()
  if (kind === 'conflict') {
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(api.session).toHaveBeenCalled())
    expect(input).toHaveValue('Keep this next draft.')
  }
})

it.each([true, false])('reconciles unknown delivery only against matching persisted answers after its baseline (persisted: %s)', async (persisted) => {
  const original = { ...baseSession, messages: [
    { id: 1, sequence: 1, role: 'student' as const, content: 'Repeated answer.', attribution: {} },
    { id: 2, sequence: 2, role: 'assistant' as const, content: ratingPrompt.text, attribution: {} },
  ] }
  const restored = { ...original, turn_version: persisted ? 2 : 1, messages: [
    ...original.messages,
    ...(persisted ? [
      { id: 3, sequence: 3, role: 'student' as const, content: 'Repeated answer.', attribution: {} },
      { id: 4, sequence: 4, role: 'assistant' as const, content: 'Next question.', attribution: {} },
    ] : []),
  ] }
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  vi.mocked(api.session).mockResolvedValueOnce(original).mockResolvedValueOnce(restored)
  vi.mocked(api.turn).mockRejectedValueOnce(new Error('Response lost'))
  const user = userEvent.setup()
  renderPage()
  const input = await screen.findByRole('textbox', { name: 'Message' })
  await user.type(input, 'Repeated answer.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost')
  await user.type(input, 'New draft must survive.')
  if (!persisted) vi.mocked(api.turn).mockRejectedValueOnce(new Error('Still offline'))
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(api.session).toHaveBeenCalledTimes(2))
  const log = screen.getByRole('log', { name: 'Conversation' })
  expect(within(log).getAllByText('Repeated answer.')).toHaveLength(2)
  if (persisted) expect(within(log).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  else expect(await within(log).findByRole('button', { name: 'Retry' })).toBeVisible()
  expect(input).toHaveValue('New draft must survive.')
  expect(api.turn).toHaveBeenCalledTimes(persisted ? 1 : 2)
})

it('consumes submitted dictation synchronously and keeps continuous dictation usable during the turn', async () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'SpeechRecognition')
  const recognition = { start: vi.fn(), stop: vi.fn(),
    onresult: null as null | ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) }
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: class { constructor() { return recognition } } })
  const pending = deferredTurn()
  try {
    const user = userEvent.setup()
    renderPage()
    await acceptConsent(user)
    const input = screen.getByRole('textbox', { name: 'Message' })
    await user.click(screen.getByRole('button', { name: 'Dictate' }))
    act(() => recognition.onresult!({ results: [{ isFinal: true, 0: { transcript: 'First spoken answer.' } }] }))
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(input).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Stop dictation' })).toBeEnabled()
    expect(recognition.stop).not.toHaveBeenCalled()
    act(() => recognition.onresult!({ results: [
      { isFinal: true, 0: { transcript: 'First spoken answer.' } },
      { isFinal: true, 0: { transcript: 'Next spoken draft.' } },
    ] }))
    expect(input).toHaveValue('Next spoken draft.')
    // A blocked programmatic submit must not consume the next speech segments.
    fireEvent.submit(input.closest('form')!)
    act(() => recognition.onresult!({ results: [
      { isFinal: true, 0: { transcript: 'First spoken answer.' } },
      { isFinal: true, 0: { transcript: 'Next spoken draft.' } },
      { isFinal: true, 0: { transcript: 'Still dictating.' } },
    ] }))
    expect(input).toHaveValue('Next spoken draft. Still dictating.')
    expect(api.turn).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve({ ...baseSession, turn_version: 2 }))
    expect(input).toHaveValue('Next spoken draft. Still dictating.')
  } finally {
    if (previous) Object.defineProperty(window, 'SpeechRecognition', previous)
    else Reflect.deleteProperty(window, 'SpeechRecognition')
  }
})

it('keeps a closed reflection locked even when environment verification succeeds', async () => {
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  vi.mocked(api.session).mockResolvedValue({ ...baseSession, status: 'closed' })
  renderPage()
  expect(await screen.findByRole('textbox', { name: 'Message' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Dictate' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
})

it('scrolls to the first optimistic answer even when the restored server transcript is empty', async () => {
  const pending = deferredTurn()
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)
  const log = screen.getByRole('log', { name: 'Conversation' })
  const scroll = vi.fn()
  Object.defineProperty(log.lastElementChild!, 'scrollIntoView', { configurable: true, value: scroll })
  await user.type(screen.getByRole('textbox', { name: 'Message' }), 'My first answer.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(scroll).toHaveBeenCalledWith({ block: 'end' })
  await act(async () => pending.resolve({ ...baseSession, turn_version: 2 }))
})

it('does not consume dictation when a second same-tick submit is rejected by the turn lock', async () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'SpeechRecognition')
  const recognition = { start: vi.fn(), stop: vi.fn(),
    onresult: null as null | ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) }
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: class { constructor() { return recognition } } })
  const pending = deferredTurn()
  try {
    const user = userEvent.setup()
    renderPage()
    await acceptConsent(user)
    const input = screen.getByRole('textbox', { name: 'Message' })
    await user.click(screen.getByRole('button', { name: 'Dictate' }))
    act(() => recognition.onresult!({ results: [{ isFinal: true, 0: { transcript: 'First speech.' } }] }))
    const nextResults = { results: [
      { isFinal: true, 0: { transcript: 'First speech.' } },
      { isFinal: true, 0: { transcript: 'Keep new speech.' } },
    ] }
    act(() => {
      fireEvent.submit(input.closest('form')!)
      recognition.onresult!(nextResults)
      fireEvent.submit(input.closest('form')!)
      recognition.onresult!(nextResults)
    })
    expect(api.turn).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue('Keep new speech.')
    await act(async () => pending.resolve({ ...baseSession, turn_version: 2 }))
    expect(input).toHaveValue('Keep new speech.')
  } finally {
    if (previous) Object.defineProperty(window, 'SpeechRecognition', previous)
    else Reflect.deleteProperty(window, 'SpeechRecognition')
  }
})

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
    request_id: expect.any(String), expected_version: 1, item_id: 'P1', kind: 'text', text: 'First answer.',
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

it.each(['answer', 'rating'] as const)('keeps modified Enter and mobile Enter as newlines in phase %s', async (phase) => {
  const active = { ...baseSession, prompt: { item_id: 'P1', phase,
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
    request_id: expect.any(String), expected_version: 12, kind: 'text', text: 'Actually, change my P1 answer to this.',
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
  expect(screen.getByRole('button', { name: 'Save draft (.pdf)' })).toBeEnabled()
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
    request_id: expect.any(String), expected_version: 1, item_id: 'P1', kind: 'text', text: 'A considered answer.',
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
  vi.mocked(api.debug).mockResolvedValue({ session_id: sessionId, turn_version: 1,
    schema_state: { item_index: 0, phase: 'rating', results: {}, answer_map: {}, evidence_seen: {}, coverage_seen: {},
      orchestration: { last_turn_diagnostics: { calls: [{ total_tokens: 130 }], turn_processing_ms: 450 } } }, responses: [] })
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
  expect(within(assistant).getByLabelText('Orchestration diagnostics')).toHaveTextContent('total_tokens')
  expect(within(assistant).getByRole('region', { name: 'Recorded debug state' })).not.toHaveAttribute('hidden')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(api.debugAccess).toHaveBeenCalledWith(surveyId)
  expect(api.debug).toHaveBeenCalledWith(surveyId, sessionId)
  expect(screen.getByText('rating', { selector: 'dd' })).toBeInTheDocument()
  await user.click(within(assistant).getByRole('button', { name: 'Hide debug state' }))
  expect(screen.queryByText('Recorded schema state')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled()
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
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

it.each([null, ratingPrompt.choices])('keeps Likert in the shared text composer without a numeric rating (choices: %j)', async (choices) => {
  vi.mocked(api.start).mockResolvedValue({ ...baseSession, token, prompt: { ...ratingPrompt, choices } })
  vi.mocked(api.turn).mockResolvedValue({ ...baseSession, turn_version: 2, prompt: reflectionPrompt, results: { P1: { rating: 4, status: 'active', probes: 0 } } })
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByRole('dialog', { name: 'Before you begin' })).toBeInTheDocument()
  await acceptConsent(user)
  expect(await screen.findByText('I think about the work.')).toBeInTheDocument()
  const composer = screen.getByTestId('chat-composer')
  const message = within(composer).getByRole('textbox', { name: 'Message' })
  expect(message).toBeVisible()
  expect(message).toBeEnabled()
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Agree$/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Prefer not to answer' })).not.toBeInTheDocument()
  expect(within(composer).getByRole('button', { name: 'Dictate' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  await user.type(message, '   ')
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  await user.clear(message)
  await user.type(message, 'I would say four, because I think through the task.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(api.turn).toHaveBeenCalledWith(surveyId, sessionId, token, {
    request_id: expect.any(String), expected_version: 1, item_id: 'P1', kind: 'text', text: 'I would say four, because I think through the task.',
  })
  expect(await screen.findByText('Why?')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('')
})

it.each(['Prefer not to answer', 'Somewhere between three and four', 'What does this scale mean?'])(
  'sends rating-phase wording unchanged for backend interpretation: %s', async (text) => {
    vi.mocked(api.turn).mockResolvedValue({ ...baseSession, turn_version: 2 })
    const user = userEvent.setup()
    renderPage()
    await acceptConsent(user)
    await user.type(screen.getByRole('textbox', { name: 'Message' }), text)
    await user.keyboard('{Enter}')
    await waitFor(() => expect(api.turn).toHaveBeenCalledWith(surveyId, sessionId, token, {
      request_id: expect.any(String), expected_version: 1, item_id: 'P1', kind: 'text', text,
    }))
  },
)

it('uses shared dictation during rating and submits its transcript as text', async () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'SpeechRecognition')
  const recognition = {
    start: vi.fn(), stop: vi.fn(),
    onresult: null as null | ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void),
  }
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: class {
    constructor() { return recognition }
  } })
  vi.mocked(api.start).mockResolvedValue({ ...baseSession, token, prompt: { ...ratingPrompt, choices: null } })
  vi.mocked(api.turn).mockResolvedValue({ ...baseSession, turn_version: 2, prompt: reflectionPrompt })
  try {
    const user = userEvent.setup()
    renderPage()
    await acceptConsent(user)
    const dictate = screen.getByRole('button', { name: 'Dictate' })
    expect(dictate).toBeEnabled()
    await user.click(dictate)
    expect(screen.getByRole('button', { name: 'Stop dictation' })).toBeEnabled()
    act(() => recognition.onresult!({ results: [{ isFinal: true, 0: { transcript: 'Four because I planned ahead.' } }] }))
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Four because I planned ahead.')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(api.turn).toHaveBeenCalledWith(surveyId, sessionId, token, {
      request_id: expect.any(String), expected_version: 1, item_id: 'P1', kind: 'text', text: 'Four because I planned ahead.',
    })
  } finally {
    if (previous) Object.defineProperty(window, 'SpeechRecognition', previous)
    else Reflect.deleteProperty(window, 'SpeechRecognition')
  }
})

it('keeps a resumed rating conversation read-only when environment verification fails', async () => {
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  renderPage(false)
  await screen.findByText(ratingPrompt.text)
  expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Dictate' })).toBeDisabled()
  expect(api.turn).not.toHaveBeenCalled()
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

it.each([reflectionPrompt, ratingPrompt])('keeps the $phase response for retry after a transient assessment failure', async (prompt) => {
  vi.mocked(api.start).mockResolvedValue({ ...baseSession, token, prompt })
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
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost')
  expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('')
  const failedBubble = within(screen.getByRole('log', { name: 'Conversation' })).getByText('I planned before asking.').closest('[data-chat-role="user"]') as HTMLElement
  expect(failedBubble).toHaveTextContent('Connection lost')
  await user.click(within(failedBubble).getByRole('button', { name: 'Retry' }))
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
  expect(await screen.findByRole('alert')).toHaveTextContent('Conversation changed')
  await user.click(screen.getByRole('button', { name: 'Refresh' }))
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


it('collects the existing anonymous browser signals only for an opted-in course', async () => {
  Object.defineProperty(window, 'FingerprintJS', { configurable: true, value: {
    load: async () => ({ get: async () => ({ visitorId: 'visitor-id' }) }),
  } })
  vi.mocked(api.survey).mockResolvedValue({ ...survey, anonymous_matching_enabled: true })
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)

  await waitFor(() => expect(api.matchingSignals).toHaveBeenCalledWith(surveyId, sessionId, token, {
    device_key: expect.any(String), fingerprint: 'visitor-id',
  }))
  expect(window.localStorage.getItem('leai_device_key')).toBeTruthy()
})

it('does not load or send matching signals when the course setting is off', async () => {
  const user = userEvent.setup()
  renderPage()
  await acceptConsent(user)

  expect(api.matchingSignals).not.toHaveBeenCalled()
  expect(document.querySelector('script[src*="fingerprintjs"]')).not.toBeInTheDocument()
  expect(window.localStorage.getItem('leai_device_key')).toBeNull()
})


it('downloads the finalized student PDF through the session capability', async () => {
  vi.mocked(api.survey).mockResolvedValue({ ...survey, completed_response_download_enabled: true })
  const complete = { ...baseSession, prompt: { phase: 'complete' as const }, progress_label: 'Reflection complete' }
  const finalized = { ...complete, status: 'completed' as const, turn_version: 2 }
  sessionStorage.setItem(`leai:local:student:${surveyId}`, JSON.stringify({ sessionId, token }))
  vi.mocked(api.session).mockResolvedValue(complete)
  vi.mocked(api.finalize).mockResolvedValue(finalized)
  const priorCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const priorRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:student-pdf') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  const downloads: string[] = []
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download)
  })
  try {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Download my reflection (.pdf)' }))
    await waitFor(() => expect(api.responsePdf).toHaveBeenCalledWith(surveyId, sessionId, token))
    expect(api.finalize).toHaveBeenCalledWith(surveyId, sessionId, token, complete.turn_version)
    expect(downloads).toEqual(['Ulia-reflection-final.pdf'])
  } finally {
    click.mockRestore()
    if (priorCreate) Object.defineProperty(URL, 'createObjectURL', priorCreate)
    else Reflect.deleteProperty(URL, 'createObjectURL')
    if (priorRevoke) Object.defineProperty(URL, 'revokeObjectURL', priorRevoke)
    else Reflect.deleteProperty(URL, 'revokeObjectURL')
  }
})
