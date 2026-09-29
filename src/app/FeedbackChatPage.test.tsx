import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
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
    { id: '11', sequence: 2, role: 'assistant' as const, content: 'Students asked for clearer steps. Source 1', created_at: '2026-09-27T12:31:45Z', citations: [{ id: '9', citation_number: 1, claim_key: 'clarity', response_id: '550e8400-e29b-41d4-a716-446655440040', response_message_id: 21, occurrence_id: occurrenceId, week_label: null, survey_label: 'Week 2 reflection', question_label: null, evidence_quote: 'The steps were confusing.' }] },
  ],
}
const api: FeedbackChatApi = {
  courses: vi.fn(), occurrences: vi.fn(), chats: vi.fn(), createChat: vi.fn(), chat: vi.fn(),
  renameChat: vi.fn(), archiveChat: vi.fn(), addChatScope: vi.fn(), createTurn: vi.fn(), job: vi.fn(), logout: vi.fn(),
}

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
  expect(within(transcript).getByText('Students asked for clearer steps. Source 1')).toBeInTheDocument()
  expect(within(transcript).getByText('Instructor')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Feedback Chat workspace' })).toContainElement(screen.getByRole('region', { name: 'Chat sessions' }))
  expect(screen.getByRole('region', { name: 'Feedback Chat workspace' })).toContainElement(transcript)
  expect(within(transcript).getByText('What themes appear?').closest('[data-chat-role="user"]')).toHaveClass('student-user-message')
  expect(within(transcript).getByText(/Students asked for clearer steps/).closest('[data-chat-role="assistant"]')).toHaveClass('student-assistant-message')
  expect(within(transcript).getByText('Instructor')).toHaveClass('student-message-meta')
  expect(screen.getByRole('textbox', { name: 'Message' }).closest('.legacy-student')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Open citation 1' }))
  expect(await screen.findByText('The steps were confusing.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument()
})

it('adds sources to the current Chat and sends an idempotent turn', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'New chat' }))
  await user.selectOptions(screen.getByRole('combobox', { name: 'Add a course source' }), secondOccurrence.id)
  await user.click(screen.getByRole('button', { name: 'Add source' }))
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
  expect(await screen.findByText(/working on your answer/i)).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Add a course source' })).toBeEnabled()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Add a course source' }), secondOccurrence.id)
  await user.click(screen.getByRole('button', { name: 'Add source' }))
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
  await user.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => expect(api.createTurn).toHaveBeenCalledTimes(2))
  const createTurn = vi.mocked(api.createTurn)
  expect(createTurn.mock.calls[1]).toEqual(createTurn.mock.calls[0])
})
