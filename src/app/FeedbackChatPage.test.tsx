import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CanonicalCourse } from '@/api/contracts/instructor'
import { AuthenticationRequiredError } from '@/api/instructor-v1'
import { getEnvironment } from '@/config/environment'
import type { FeedbackChatApi } from './FeedbackChatPage'
import { FeedbackChatPage } from './FeedbackChatPage'

const environment = getEnvironment({})
const courseId = '550e8400-e29b-41d4-a716-446655440000'
const chatId = '550e8400-e29b-41d4-a716-446655440010'
const occurrenceId = '550e8400-e29b-41d4-a716-446655440020'
const jobId = '550e8400-e29b-41d4-a716-446655440030'
const course: CanonicalCourse = {
  course_id: courseId, course_code: 'cmpm-80h', course_name: 'Game Design', institution_slug: 'ucsc',
  lifecycle_state: 'active', role: 'owner', allowed_actions: ['analysis.use'],
}
const occurrence = { id: occurrenceId, label: 'Week 2 reflection', revision: 1 }
const secondOccurrence = { id: '550e8400-e29b-41d4-a716-446655440021', label: 'Week 3 reflection', revision: 1 }
const chat = {
  id: chatId, title: 'Week 2 feedback', prompt_override: null, archived: false,
  updated_at: '2026-09-27T12:30:45Z', sources: [occurrence],
  messages: [
    { id: '10', sequence: 1, role: 'user' as const, content: 'What themes appear?', created_at: '2026-09-27T12:30:45Z', citations: [] },
    { id: '11', sequence: 2, role: 'assistant' as const, content: 'Students asked for clearer steps. [1]', created_at: '2026-09-27T12:31:45Z', citations: [{ id: '9', citation_number: 1, claim_key: 'clarity', response_id: '550e8400-e29b-41d4-a716-446655440040', response_message_id: 21, occurrence_id: occurrenceId, week_label: null, survey_label: 'Week 2 reflection', question_label: null, evidence_quote: 'The steps were confusing.' }] },
  ],
}
const api: FeedbackChatApi = {
  courses: vi.fn(), occurrences: vi.fn(), chats: vi.fn(), createChat: vi.fn(), chat: vi.fn(),
  renameChat: vi.fn(), archiveChat: vi.fn(), addChatScope: vi.fn(), createTurn: vi.fn(), job: vi.fn(), logout: vi.fn(),
}

afterEach(() => vi.unstubAllGlobals())

function renderPage() {
  sessionStorage.setItem('leai:local:selected-course', courseId)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><FeedbackChatPage api={api} environment={environment} verified /></QueryClientProvider>)
  return client
}

beforeEach(() => {
  sessionStorage.clear()
  window.history.replaceState({}, '', '/FeedbackChat.html')
  vi.mocked(api.courses).mockReset().mockResolvedValue({ courses: [course] })
  vi.mocked(api.occurrences).mockReset().mockResolvedValue({ occurrences: [occurrence, secondOccurrence] })
  vi.mocked(api.chats).mockReset().mockResolvedValue({ chats: [{ id: chatId, title: chat.title, updated_at: chat.updated_at }] })
  vi.mocked(api.createChat).mockReset().mockResolvedValue(chat)
  vi.mocked(api.chat).mockReset().mockResolvedValue(chat)
  vi.mocked(api.renameChat).mockReset().mockResolvedValue({ ...chat, title: 'Renamed feedback' })
  vi.mocked(api.archiveChat).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.addChatScope).mockReset().mockResolvedValue(chat)
  vi.mocked(api.createTurn).mockReset().mockResolvedValue({ job_id: jobId })
  vi.mocked(api.job).mockReset().mockResolvedValue({ id: jobId, status: 'completed', error_code: null, result: { assistant_message_id: '11' } })
  vi.mocked(api.logout).mockReset().mockResolvedValue(undefined)
})

it('creates a Chat and composes the existing transcript, messages, composer, and citations', async () => {
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Week 2 feedback')).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Course' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create another Chat' })).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: 'New chat' }))
  const transcript = await screen.findByRole('log', { name: 'Conversation' })
  expect(transcript).toHaveClass('student-transcript', 'px-5', 'py-10', 'sm:gap-8', 'sm:px-0', 'sm:py-12')
  expect(within(transcript).getByText('Students asked for clearer steps.')).toBeInTheDocument()
  expect(within(transcript).getByRole('button', { name: 'Open citation 1' })).toBeInTheDocument()
  expect(within(transcript).getByText('Instructor')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Feedback Chat workspace' })).toContainElement(screen.getByRole('region', { name: 'Chat sessions' }))
  expect(screen.getByRole('region', { name: 'Feedback Chat workspace' })).toContainElement(transcript)
  expect(within(transcript).getByText('What themes appear?').closest('[data-chat-role="user"]')).toHaveClass('student-user-message')
  expect(within(transcript).getByText(/Students asked for clearer steps/).closest('[data-chat-role="assistant"]')).toHaveClass('student-assistant-message')
  expect(within(transcript).getByText('Instructor')).toHaveClass('student-message-meta')
  expect(screen.getByRole('textbox', { name: 'Message' }).closest('.legacy-student')).toBeInTheDocument()
  const composer = screen.getByTestId('chat-composer')
  expect(within(composer).getByRole('button', { name: 'Dictate' })).toBeInTheDocument()
  expect(within(composer).getByRole('button', { name: 'Send' })).toHaveClass('chat-composer-send')
  await user.click(screen.getByRole('button', { name: 'Open citation 1' }))
  expect(await screen.findByText('“The steps were confusing.”')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument()
})

it('adds sources to the current Chat and sends an idempotent turn', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'New chat' }))
  await user.click(screen.getByRole('button', { name: /feedback source.*Change/i }))
  await user.click(screen.getByRole('checkbox', { name: secondOccurrence.label }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(api.addChatScope).toHaveBeenCalledWith(courseId, chatId, { occurrence_ids: [secondOccurrence.id] }))
  const composer = screen.getByRole('textbox', { name: 'Message' })
  await user.type(composer, 'What themes appear?')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(api.createTurn).toHaveBeenCalledWith(courseId, chatId, { content: 'What themes appear?' }, expect.any(String)))
  expect(await screen.findByRole('status')).toHaveTextContent(/complete|updated/i)
})

it('keeps source controls available while a queued turn polls', async () => {
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'pending', error_code: null, result: null })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'New chat' }))
  await user.type(screen.getByRole('textbox', { name: 'Message' }), 'First question')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByRole('status', { name: 'LEAI is responding' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /feedback source.*Change/i }))
  expect(screen.getByRole('checkbox', { name: secondOccurrence.label })).toBeEnabled()
  await user.click(screen.getByRole('checkbox', { name: secondOccurrence.label }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(api.addChatScope).toHaveBeenCalledWith(courseId, chatId, { occurrence_ids: [secondOccurrence.id] }))
})

it('clears protected state and returns to sign-in when auth expires', async () => {
  sessionStorage.setItem('leai:local:instructor-token', 'opaque-session')
  vi.mocked(api.courses).mockRejectedValueOnce(new AuthenticationRequiredError())
  renderPage()
  expect(await screen.findByText('Returning to sign-in…')).toBeInTheDocument()
  await waitFor(() => expect(sessionStorage.getItem('leai:local:instructor-token')).toBeNull())
  expect(sessionStorage.getItem('leai:local:selected-course')).toBeNull()
})

it('clears protected state when a Chat detail request discovers expired auth', async () => {
  sessionStorage.setItem('leai:local:instructor-token', 'opaque-session')
  vi.mocked(api.chat).mockRejectedValueOnce(new AuthenticationRequiredError())
  renderPage()
  expect(await screen.findByText('Returning to sign-in…')).toBeInTheDocument()
  await waitFor(() => expect(sessionStorage.getItem('leai:local:instructor-token')).toBeNull())
  expect(sessionStorage.getItem('leai:local:selected-course')).toBeNull()
})

it('shows the just-saved user turn and retries that turn after a worker failure', async () => {
  const retryJobId = '550e8400-e29b-41d4-a716-446655440031'
  const updatedChat = {
    ...chat,
    messages: [...chat.messages, { id: '12', sequence: 3, role: 'user' as const, content: 'A new question just saved.', created_at: '2026-09-27T12:32:45Z', citations: [] }],
  }
  let turnCount = 0
  vi.mocked(api.chat).mockImplementation(async () => turnCount > 0 ? updatedChat : chat)
  vi.mocked(api.createTurn).mockImplementation(async () => ({ job_id: turnCount++ === 0 ? jobId : retryJobId }))
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'failed', error_code: 'turn_failed', result: null })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'New chat' }))
  await user.type(screen.getByRole('textbox', { name: 'Message' }), 'A new question just saved.')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByText('A new question just saved.')).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: 'Retry last question' }))
  await waitFor(() => expect(api.createTurn).toHaveBeenLastCalledWith(courseId, chatId, { content: 'A new question just saved.', retry_message_id: '12' }, expect.any(String)))
})

it('warns before manually retrying a turn with an unknown provider outcome', async () => {
  const updatedChat = {
    ...chat,
    messages: [...chat.messages, { id: '12', sequence: 3, role: 'user' as const, content: 'What changed?', created_at: '2026-09-27T12:32:45Z', citations: [] }],
  }
  vi.mocked(api.chat).mockResolvedValue(updatedChat)
  vi.mocked(api.createTurn).mockResolvedValue({ job_id: jobId })
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'failed', error_code: 'provider_outcome_unknown', result: null })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'New chat' }))
  await user.type(screen.getByRole('textbox', { name: 'Message' }), 'What changed?')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('The AI provider may have received this question.')
  expect(api.createTurn).toHaveBeenCalledTimes(1)
  await user.click(await screen.findByRole('button', { name: 'Retry last question' }))
  await waitFor(() => expect(api.createTurn).toHaveBeenLastCalledWith(courseId, chatId, { content: 'What changed?', retry_message_id: '12' }, expect.any(String)))
})

it('shows administrator cancellation and permits only a deliberate retry', async () => {
  const updatedChat = {
    ...chat,
    messages: [...chat.messages, { id: '12', sequence: 3, role: 'user' as const, content: 'What changed?', created_at: '2026-09-27T12:32:45Z', citations: [] }],
  }
  vi.mocked(api.chat).mockResolvedValue(updatedChat)
  vi.mocked(api.createTurn).mockResolvedValue({ job_id: jobId })
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'cancelled', error_code: 'admin_cancelled', result: null })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'New chat' }))
  await user.type(screen.getByRole('textbox', { name: 'Message' }), 'What changed?')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This answer was cancelled by an administrator.')
  expect(api.createTurn).toHaveBeenCalledTimes(1)
  expect(await screen.findByRole('button', { name: 'Retry last question' })).toBeInTheDocument()
})

it('loads each Chat instructions draft from the selected Chat', async () => {
  const otherChatId = '550e8400-e29b-41d4-a716-446655440011'
  const otherChat = { ...chat, id: otherChatId, title: 'Course themes', prompt_override: 'Focus on week-to-week changes.' }
  vi.mocked(api.chats).mockResolvedValue({ chats: [
    { id: chatId, title: chat.title, updated_at: chat.updated_at },
    { id: otherChatId, title: otherChat.title, updated_at: otherChat.updated_at },
  ] })
  vi.mocked(api.chat).mockImplementation(async (_courseId, selectedId) => selectedId === otherChatId ? otherChat : chat)
  const user = userEvent.setup()
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Course themes' }))
  await user.click(screen.getByText('Chat instructions'))

  expect(await screen.findByRole('textbox', { name: 'Optional instructions for this Chat' })).toHaveValue('Focus on week-to-week changes.')
})

it('reuses the same idempotency key when retrying a turn whose response was lost', async () => {
  vi.mocked(api.createTurn)
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ job_id: jobId })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'New chat' }))
  await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Did anything change?')

  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('request could not be completed')
  await user.click(screen.getByRole('button', { name: 'Retry delivery' }))

  await waitFor(() => expect(api.createTurn).toHaveBeenCalledTimes(2))
  const createTurn = vi.mocked(api.createTurn)
  expect(createTurn.mock.calls[1]).toEqual(createTurn.mock.calls[0])
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

it('shows the user bubble and clears the draft before ACK, keeping input editable and guarding immediate duplicate sends', async () => {
  const ack = deferred<{ job_id: string }>()
  vi.mocked(api.createTurn).mockReturnValue(ack.promise)
  const user = userEvent.setup()
  renderPage()
  const composer = await screen.findByRole('textbox', { name: 'Message' })
  await user.type(composer, 'Before acknowledgement')
  const form = composer.closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(composer).toHaveValue('')
  expect(composer).toBeEnabled()
  expect(within(screen.getByRole('log')).getAllByText('Before acknowledgement')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled()
  await waitFor(() => expect(api.createTurn).toHaveBeenCalledTimes(1))
  await user.type(composer, 'Next draft')
  const running = { id: jobId, status: 'running' as const, error_code: null, result: null }
  vi.mocked(api.job).mockResolvedValue(running)
  await act(async () => ack.resolve({ job_id: jobId }))
  expect(composer).toHaveValue('Next draft')
  expect(composer).toBeEnabled()
  fireEvent.submit(form)
  expect(api.createTurn).toHaveBeenCalledTimes(1)
})

it('reconciles the optimistic turn once, retains the next draft through AI completion, and uses LEAI thinking inside the transcript', async () => {
  const ack = deferred<{ job_id: string }>()
  vi.mocked(api.createTurn).mockReturnValue(ack.promise)
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'running', error_code: null, result: null })
  const user = userEvent.setup()
  const client = renderPage()
  const composer = await screen.findByRole('textbox', { name: 'Message' })
  await user.type(composer, 'Fresh question')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  const transcript = screen.getByRole('log')
  const thinking = within(transcript).getByRole('status')
  expect(thinking.closest('[data-chat-role="assistant"]')).toHaveTextContent('LEAI')
  await user.type(composer, 'Keep this next draft')
  const saved = { ...chat, messages: [...chat.messages, { id: '12', sequence: 3, role: 'user' as const, content: 'Fresh question', created_at: '2026-09-29T12:30:45Z', citations: [] }] }
  vi.mocked(api.chat).mockResolvedValue(saved)
  await act(async () => ack.resolve({ job_id: jobId }))
  await waitFor(() => expect(within(transcript).getAllByText('Fresh question')).toHaveLength(1))
  expect(composer).toHaveValue('Keep this next draft')
  vi.mocked(api.chat).mockResolvedValue({ ...saved, messages: [...saved.messages, { id: '13', sequence: 4, role: 'assistant', content: 'The new answer', created_at: '2026-09-29T12:31:45Z', citations: [] }] })
  await act(async () => {
    client.setQueryData(['feedback-chat-job', environment.name, courseId, jobId], { id: jobId, status: 'completed', error_code: null, result: { assistant_message_id: '13' } })
  })
  expect(await within(transcript).findByText('The new answer')).toBeInTheDocument()
  expect(within(transcript).getAllByText('Fresh question')).toHaveLength(1)
  expect(within(transcript).queryByRole('status')).not.toBeInTheDocument()
  expect(composer).toHaveValue('Keep this next draft')
})

it('keeps a new draft on delivery failure and retries the original request without another bubble', async () => {
  const ack = deferred<{ job_id: string }>()
  vi.mocked(api.createTurn).mockReturnValueOnce(ack.promise)
  const user = userEvent.setup()
  renderPage()
  const composer = await screen.findByRole('textbox', { name: 'Message' })
  await user.type(composer, 'Lost acknowledgement')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await user.type(composer, 'New draft stays')
  await act(async () => ack.reject(new TypeError('Failed to fetch')))
  expect(await screen.findByRole('alert')).toHaveTextContent(/delivery.*not confirmed/i)
  expect(composer).toHaveValue('New draft stays')
  expect(within(screen.getByRole('log')).queryByRole('status')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Retry delivery' }))
  await waitFor(() => expect(api.createTurn).toHaveBeenCalledTimes(2))
  expect(vi.mocked(api.createTurn).mock.calls[1]).toEqual(vi.mocked(api.createTurn).mock.calls[0])
  expect(within(screen.getByRole('log')).getAllByText('Lost acknowledgement')).toHaveLength(1)
  expect(composer).toHaveValue('New draft stays')
})

it('uses shared desktop Enter exactly once and preserves Cmd/Ctrl newline', async () => {
  const ack = deferred<{ job_id: string }>()
  vi.mocked(api.createTurn).mockReturnValue(ack.promise)
  const user = userEvent.setup()
  renderPage()
  const composer = await screen.findByRole('textbox', { name: 'Message' })
  await user.type(composer, 'Line one')
  await user.keyboard('{Control>}{Enter}{/Control}Line two')
  expect(composer).toHaveValue('Line one\nLine two')
  expect(api.createTurn).not.toHaveBeenCalled()
  await user.keyboard('{Meta>}{Enter}{/Meta}Line three')
  expect(composer).toHaveValue('Line one\nLine two\nLine three')
  await user.keyboard('{Enter}')
  expect(composer).toHaveValue('')
  await waitFor(() => expect(api.createTurn).toHaveBeenCalledTimes(1))
  expect(api.createTurn).toHaveBeenCalledWith(courseId, chatId, { content: 'Line one\nLine two\nLine three' }, expect.any(String))
})

it('keeps dictation active through submit and blocked sends without replaying consumed recognition text', async () => {
  let recognition!: FakeRecognition
  class FakeRecognition {
    continuous = true; interimResults = true; lang = ''
    onresult: ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    start = vi.fn(); stop = vi.fn(() => this.onend?.())
    constructor() { recognition = this }
  }
  vi.stubGlobal('SpeechRecognition', FakeRecognition)
  const ack = deferred<{ job_id: string }>()
  vi.mocked(api.createTurn).mockReturnValue(ack.promise)
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'running', error_code: null, result: null })
  const user = userEvent.setup()
  renderPage()
  const composer = await screen.findByRole('textbox', { name: 'Message' })
  await user.click(screen.getByRole('button', { name: 'Dictate' }))
  const speak = (words: string[]) => act(() => recognition.onresult?.({ results: words.map(transcript => ({ isFinal: true, 0: { transcript } })) }))
  speak(['Spoken question'])
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(composer).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Stop dictation' })).toBeEnabled()
  speak(['Spoken question', 'Next spoken draft'])
  expect(composer).toHaveValue('Next spoken draft')
  fireEvent.submit(composer.closest('form')!)
  speak(['Spoken question', 'Next spoken draft', 'more detail'])
  expect(composer).toHaveValue('Next spoken draft more detail')
  await act(async () => ack.resolve({ job_id: jobId }))
  expect(screen.getByRole('button', { name: 'Stop dictation' })).toBeEnabled()
  expect(recognition.stop).not.toHaveBeenCalled()
  expect(composer).toHaveValue('Next spoken draft more detail')
  expect(api.createTurn).toHaveBeenCalledTimes(1)
})

it('blocks sending while a restored job awaits its first poll without consuming the draft', async () => {
  sessionStorage.setItem(`leai:local:feedback-chat-job:${chatId}`, jobId)
  vi.mocked(api.job).mockReturnValue(deferred<Awaited<ReturnType<FeedbackChatApi['job']>>>().promise)
  const user = userEvent.setup()
  renderPage()
  const composer = await screen.findByRole('textbox', { name: 'Message' })
  await user.type(composer, 'While the job loads')
  fireEvent.submit(composer.closest('form')!)
  expect(api.createTurn).not.toHaveBeenCalled()
  expect(composer).toHaveValue('While the job loads')
  expect(composer).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled()
})

it('does not show an extra thinking assistant when the persisted answer arrives before job completion', async () => {
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'running', error_code: null, result: null })
  const user = userEvent.setup()
  const client = renderPage()
  const composer = await screen.findByRole('textbox', { name: 'Message' })
  await user.type(composer, 'Question with an early answer')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  const transcript = screen.getByRole('log')
  expect(await within(transcript).findByRole('status', { name: 'LEAI is responding' })).toBeInTheDocument()
  const answered = { ...chat, messages: [...chat.messages,
    { id: '12', sequence: 3, role: 'user' as const, content: 'Question with an early answer', created_at: '2026-09-29T12:30:45Z', citations: [] },
    { id: '13', sequence: 4, role: 'assistant' as const, content: 'Persisted answer before the next poll', created_at: '2026-09-29T12:31:45Z', citations: [] },
  ] }
  await waitFor(() => expect(api.job).toHaveBeenCalled())
  act(() => client.setQueryData(['feedback-chat', environment.name, courseId, chatId], answered))
  expect(within(transcript).getAllByText('Question with an early answer')).toHaveLength(1)
  expect(await within(transcript).findByText('Persisted answer before the next poll')).toBeInTheDocument()
  expect(within(transcript).queryByRole('status', { name: 'LEAI is responding' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled()
})

it('keeps a late ACK job attached to its original Chat after switching Chats', async () => {
  const otherChatId = '550e8400-e29b-41d4-a716-446655440011'
  const otherChat = { ...chat, id: otherChatId, title: 'Other conversation' }
  vi.mocked(api.chats).mockResolvedValue({ chats: [chat, otherChat] })
  vi.mocked(api.chat).mockImplementation(async (_course, id) => id === otherChatId ? otherChat : chat)
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'running', error_code: null, result: null })
  const ack = deferred<{ job_id: string }>()
  vi.mocked(api.createTurn).mockReturnValue(ack.promise)
  const user = userEvent.setup()
  renderPage()
  const composer = await screen.findByRole('textbox', { name: 'Message' })
  await user.type(composer, 'Original Chat question')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await user.click(screen.getByRole('button', { name: otherChat.title }))
  await screen.findByRole('heading', { name: otherChat.title })
  const otherComposer = screen.getByRole('textbox', { name: 'Message' })
  await user.type(otherComposer, 'Other Chat draft')
  await act(async () => ack.resolve({ job_id: jobId }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled())
  expect(api.job).not.toHaveBeenCalled()
  expect(sessionStorage.getItem(`leai:local:feedback-chat-job:${chatId}`)).toBe(jobId)
  expect(sessionStorage.getItem(`leai:local:feedback-chat-job:${otherChatId}`)).toBeNull()
  expect(otherComposer).toHaveValue('Other Chat draft')
  expect(within(screen.getByRole('log')).queryByRole('status', { name: 'LEAI is responding' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: chat.title }))
  expect(await screen.findByRole('status', { name: 'LEAI is responding' })).toBeInTheDocument()
  await waitFor(() => expect(api.job).toHaveBeenCalledWith(courseId, jobId, expect.any(AbortSignal)))
})

it('scrolls the real transcript end anchor for optimistic and persisted messages, not draft typing', async () => {
  const ack = deferred<{ job_id: string }>()
  vi.mocked(api.createTurn).mockReturnValue(ack.promise)
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'running', error_code: null, result: null })
  const user = userEvent.setup()
  const client = renderPage()
  const composer = await screen.findByRole('textbox', { name: 'Message' })
  const transcript = screen.getByRole('log')
  const anchor = transcript.lastElementChild!
  const scroll = vi.fn()
  Object.defineProperty(anchor, 'scrollIntoView', { configurable: true, value: scroll })
  await user.type(composer, 'New question at the end')
  expect(scroll).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(scroll).toHaveBeenCalledWith({ block: 'end' })
  expect(transcript.lastElementChild).toBe(anchor)
  expect(within(transcript).getByText('New question at the end')).toBeInTheDocument()
  expect(within(transcript).getByRole('status', { name: 'LEAI is responding' })).toBeInTheDocument()
  scroll.mockClear()
  await user.type(composer, 'Next draft without scrolling')
  expect(scroll).not.toHaveBeenCalled()
  await act(async () => ack.resolve({ job_id: jobId }))
  await waitFor(() => expect(api.job).toHaveBeenCalled())
  scroll.mockClear()
  act(() => client.setQueryData(['feedback-chat', environment.name, courseId, chatId], { ...chat, messages: [...chat.messages,
    { id: '12', sequence: 3, role: 'user', content: 'New question at the end', created_at: '2026-09-29T12:30:45Z', citations: [] },
    { id: '13', sequence: 4, role: 'assistant', content: 'Answer at the end', created_at: '2026-09-29T12:31:45Z', citations: [] },
  ] }))
  expect(await within(transcript).findByText('Answer at the end')).toBeInTheDocument()
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'end' }))
  scroll.mockClear()
  await user.type(composer, ' more typing')
  expect(scroll).not.toHaveBeenCalled()
})
