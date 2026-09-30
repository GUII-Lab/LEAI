import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ChatRetryStatus } from './ChatRetryStatus'

it('keeps recovery next to its caption and blocks repeated retries while busy', async () => {
  const onRetry = vi.fn()
  const user = userEvent.setup()
  const { rerender } = render(<ChatRetryStatus kind="connection" onRetry={onRetry} />)
  const retry = screen.getByRole('button', { name: 'Retry' })
  expect(screen.getByRole('alert')).toContainElement(retry)
  await user.click(retry)
  expect(onRetry).toHaveBeenCalledOnce()
  rerender(<ChatRetryStatus kind="connection" onRetry={onRetry} busy />)
  await user.click(screen.getByRole('button', { name: 'Retrying…' }))
  expect(onRetry).toHaveBeenCalledOnce()
})
