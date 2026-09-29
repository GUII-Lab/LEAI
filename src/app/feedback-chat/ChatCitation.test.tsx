import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ChatCitation, type ChatCitationSource } from './ChatCitation'

const citation: ChatCitationSource = {
  citationId: 'citation-internal-123',
  citationNumber: 2,
  surveyLabel: 'Course reflection survey',
  weekLabel: 'Week 2',
  questionLabel: 'What would you change?',
  responseExcerpt: 'I would like more time to compare our approaches.',
}

it('shows exact anonymous source context in a dismissible popover', async () => {
  const user = userEvent.setup()
  render(<ChatCitation citation={citation} />)

  const trigger = screen.getByRole('button', { name: 'Open citation 2' })
  await user.click(trigger)

  expect(await screen.findByRole('heading', { name: 'Source 2' })).toBeVisible()
  expect(screen.getByText('Course reflection survey')).toBeVisible()
  expect(screen.getByText('Week 2')).toBeVisible()
  expect(screen.getByText('What would you change?')).toBeVisible()
  expect(screen.getByText('“I would like more time to compare our approaches.”')).toBeVisible()
  expect(screen.queryByText('citation-internal-123')).not.toBeInTheDocument()
  expect(screen.queryByText(/session key|student name|api payload/i)).not.toBeInTheDocument()
})

it('supports keyboard dismissal and restores focus to the citation', async () => {
  const user = userEvent.setup()
  render(<ChatCitation citation={citation} />)

  const trigger = screen.getByRole('button', { name: 'Open citation 2' })
  await user.click(trigger)
  expect(await screen.findByRole('heading', { name: 'Source 2' })).toBeVisible()
  await user.keyboard('{Escape}')

  expect(screen.queryByRole('heading', { name: 'Source 2' })).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('passes the typed citation to the optional source navigation callback', async () => {
  const user = userEvent.setup()
  const onOpenSource = vi.fn()
  render(<ChatCitation citation={citation} onOpenSource={onOpenSource} />)

  await user.click(screen.getByRole('button', { name: 'Open citation 2' }))
  await user.click(await screen.findByRole('button', { name: 'Open full response' }))

  expect(onOpenSource).toHaveBeenCalledWith(citation)
})
