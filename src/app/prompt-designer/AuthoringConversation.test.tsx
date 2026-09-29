import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { WizardConversationMessage } from '@/api/contracts/wizard'
import { AuthoringConversation } from './AuthoringConversation'

function ConversationHarness({ onSend }: { onSend: () => void }) {
  const [value, setValue] = useState('')
  return <TooltipProvider><AuthoringConversation busy={false} disabled={false} messages={[] as WizardConversationMessage[]}
    onSend={onSend} onValueChange={setValue} value={value} /></TooltipProvider>
}

it('matches Student Chat keyboard send behavior and shows the Mac shortcut hint', async () => {
  const user = userEvent.setup()
  const onSend = vi.fn()
  render(<ConversationHarness onSend={onSend} />)

  const composer = screen.getByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' })
  await user.type(composer, 'make the questions shorter')
  await user.keyboard('{Enter}')

  await waitFor(() => expect(onSend).toHaveBeenCalledOnce())
  expect(await screen.findByRole('tooltip')).toHaveTextContent('⌘+Enter')
  expect(screen.getByRole('tooltip')).toHaveTextContent('Ctrl+Enter')
})

it('keeps Meta+Enter as a newline on desktop', async () => {
  const user = userEvent.setup()
  const onSend = vi.fn()
  render(<ConversationHarness onSend={onSend} />)

  const composer = screen.getByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' })
  await user.type(composer, 'first line')
  await user.keyboard('{Meta>}{Enter}{/Meta}')

  expect(composer).toHaveValue('first line\n')
  expect(onSend).not.toHaveBeenCalled()
})
