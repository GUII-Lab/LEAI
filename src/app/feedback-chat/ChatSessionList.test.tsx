import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ChatSessionList, type ChatSessionSummary } from './ChatSessionList'

const sessions: ChatSessionSummary[] = [
  { id: 'chat-1', title: 'Week 2 reflections' },
  { id: 'chat-2', title: 'Course themes' },
]

function renderSessionList(overrides: Partial<React.ComponentProps<typeof ChatSessionList>> = {}) {
  const props: React.ComponentProps<typeof ChatSessionList> = {
    sessions,
    selectedSessionId: 'chat-1',
    status: 'ready',
    onCreateSession: vi.fn(),
    onSelectSession: vi.fn(),
    onRenameSession: vi.fn(),
    onArchiveSession: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  }
  return { ...render(<ChatSessionList {...props} />), props }
}

it('creates a new chat and selects a session through explicit callbacks', async () => {
  const user = userEvent.setup()
  const onCreateSession = vi.fn()
  const onSelectSession = vi.fn()
  renderSessionList({ onCreateSession, onSelectSession })

  await user.click(screen.getByRole('button', { name: 'New chat' }))
  await user.click(screen.getByRole('button', { name: 'Course themes' }))

  expect(onCreateSession).toHaveBeenCalledOnce()
  expect(onSelectSession).toHaveBeenCalledWith('chat-2')
  expect(screen.getByRole('button', { name: 'Week 2 reflections' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Course themes' })).toHaveAttribute('aria-pressed', 'false')
})

it('renames a session with its trimmed title', async () => {
  const user = userEvent.setup()
  const onRenameSession = vi.fn()
  renderSessionList({ onRenameSession })

  await user.click(screen.getByRole('button', { name: 'Rename Week 2 reflections' }))
  const titleInput = screen.getByRole('textbox', { name: 'Rename Week 2 reflections' })
  await user.clear(titleInput)
  await user.type(titleInput, '  Week 2 discussion  ')
  await user.click(screen.getByRole('button', { name: 'Save title' }))

  expect(onRenameSession).toHaveBeenCalledWith('chat-1', 'Week 2 discussion')
})

it('preserves a failed async rename draft and offers a retry', async () => {
  const user = userEvent.setup()
  const onRenameSession = vi.fn()
    .mockRejectedValueOnce(new Error('temporary network failure'))
    .mockResolvedValueOnce(undefined)
  renderSessionList({ onRenameSession })

  await user.click(screen.getByRole('button', { name: 'Rename Week 2 reflections' }))
  const titleInput = screen.getByRole('textbox', { name: 'Rename Week 2 reflections' })
  await user.clear(titleInput)
  await user.type(titleInput, 'Week 2 discussion')
  await user.click(screen.getByRole('button', { name: 'Save title' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Title could not be saved')
  expect(screen.getByRole('textbox', { name: 'Rename Week 2 reflections' })).toHaveValue('Week 2 discussion')
  await user.click(screen.getByRole('button', { name: 'Retry save' }))

  await waitFor(() => expect(onRenameSession).toHaveBeenCalledTimes(2))
  expect(onRenameSession).toHaveBeenNthCalledWith(2, 'chat-1', 'Week 2 discussion')
})

it('returns focus to the rename action after a successful save', async () => {
  const user = userEvent.setup()
  const onRenameSession = vi.fn().mockResolvedValue(undefined)
  renderSessionList({ onRenameSession })

  const renameButton = screen.getByRole('button', { name: 'Rename Week 2 reflections' })
  await user.click(renameButton)
  const titleInput = screen.getByRole('textbox', { name: 'Rename Week 2 reflections' })
  await user.clear(titleInput)
  await user.type(titleInput, 'Week 2 discussion')
  await user.click(screen.getByRole('button', { name: 'Save title' }))

  await waitFor(() => expect(screen.getByRole('button', { name: 'Rename Week 2 reflections' })).toHaveFocus())
})

it('returns focus to the rename action after cancelling', async () => {
  const user = userEvent.setup()
  renderSessionList()

  const renameButton = screen.getByRole('button', { name: 'Rename Week 2 reflections' })
  await user.click(renameButton)
  await user.click(screen.getByRole('button', { name: 'Cancel rename' }))

  await waitFor(() => expect(screen.getByRole('button', { name: 'Rename Week 2 reflections' })).toHaveFocus())
})

it('does not submit an empty rename and can cancel editing', async () => {
  const user = userEvent.setup()
  const onRenameSession = vi.fn()
  renderSessionList({ onRenameSession })

  await user.click(screen.getByRole('button', { name: 'Rename Week 2 reflections' }))
  await user.clear(screen.getByRole('textbox', { name: 'Rename Week 2 reflections' }))
  await user.click(screen.getByRole('button', { name: 'Save title' }))
  expect(onRenameSession).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Cancel rename' }))
  expect(screen.getByRole('button', { name: 'Week 2 reflections' })).toBeVisible()
})

it('archives the requested session through a callback', async () => {
  const user = userEvent.setup()
  const onArchiveSession = vi.fn()
  renderSessionList({ onArchiveSession })

  await user.click(screen.getByRole('button', { name: 'Archive Course themes' }))

  expect(onArchiveSession).toHaveBeenCalledWith('chat-2')
})

it('shows loading, empty, and retryable error states', async () => {
  const { rerender, props } = renderSessionList({ status: 'loading', sessions: [] })
  expect(screen.getByRole('status')).toHaveTextContent('Loading chats')
  expect(screen.queryByRole('list', { name: 'Chat sessions' })).not.toBeInTheDocument()

  rerender(<ChatSessionList {...props} status="ready" sessions={[]} />)
  expect(screen.getByText('No chats yet')).toBeVisible()

  const user = userEvent.setup()
  rerender(<ChatSessionList {...props} status="error" sessions={[]} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Chats could not be loaded')
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(props.onRetry).toHaveBeenCalledOnce()
})

it('keeps the session controls in an accessible named region', () => {
  renderSessionList()
  const region = screen.getByRole('region', { name: 'Chat sessions' })
  expect(within(region).getByRole('list', { name: 'Chat sessions' })).toBeInTheDocument()
  expect(within(region).getByRole('button', { name: 'New chat' })).toBeInTheDocument()
})
