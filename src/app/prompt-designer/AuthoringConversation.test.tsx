import { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { WizardConversationMessage } from '@/api/contracts/wizard'
import { AuthoringConversation } from './AuthoringConversation'

function ConversationHarness({ onSend, busy = false }: { onSend: () => void; busy?: boolean }) {
  const [value, setValue] = useState('')
  return <TooltipProvider><AuthoringConversation busy={busy} disabled={false} messages={[] as WizardConversationMessage[]}
    onSend={onSend} onValueChange={setValue} value={value} /></TooltipProvider>
}

const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
afterEach(() => {
  vi.unstubAllGlobals()
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

it('scrolls the transcript end for optimistic messages, thinking, reconciliation, and replies, but not typing', async () => {
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  const user = userEvent.setup()
  const history: WizardConversationMessage[] = Array.from({ length: 25 }, (_, index) => ({
    id: String(index + 1), role: 'assistant', content: `Earlier reply ${index + 1}`, created_at: '2026-09-29T12:00:00Z',
  }))
  function renderConversation(messages: WizardConversationMessage[], busy: boolean, value = '') {
    return <TooltipProvider><AuthoringConversation busy={busy} disabled={false} messages={messages}
      onSend={() => {}} onValueChange={() => {}} value={value} /></TooltipProvider>
  }
  const { rerender } = render(renderConversation(history, false))
  const log = screen.getByRole('log')
  expect(scroll).toHaveBeenLastCalledWith({ block: 'end' })
  expect(scroll.mock.contexts.at(-1)).toBe(log.lastElementChild)
  scroll.mockClear()
  await user.type(screen.getByRole('textbox'), 'typing without scrolling')
  rerender(renderConversation([...history], false, 'new draft'))
  expect(scroll).not.toHaveBeenCalled()

  const optimistic: WizardConversationMessage = { id: 'local-1', role: 'user', content: 'Shorten it', created_at: '2026-09-29T12:01:00Z' }
  const pending = [...history, optimistic]
  rerender(renderConversation(pending, true))
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'end' })
  expect(scroll.mock.contexts[0]).toBe(log.lastElementChild)
  scroll.mockClear()
  rerender(renderConversation([...pending], true, 'next draft while thinking'))
  expect(scroll).not.toHaveBeenCalled()

  const persisted = [...history, { ...optimistic, id: '26' }]
  rerender(renderConversation(persisted, true))
  expect(scroll).toHaveBeenCalledOnce()
  scroll.mockClear()
  rerender(renderConversation([...persisted, { id: '27', role: 'assistant', content: 'Updated.', created_at: '2026-09-29T12:02:00Z' }], false))
  expect(scroll).toHaveBeenCalledOnce()
  expect(scroll.mock.contexts[0]).toBe(log.lastElementChild)
  scroll.mockClear()
  rerender(renderConversation(persisted, true))
  scroll.mockClear()
  rerender(renderConversation([...persisted], false))
  expect(scroll).toHaveBeenCalledOnce()
})

it('scrolls to thinking even before any server message exists', () => {
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  const props = { disabled: false, messages: [] as WizardConversationMessage[], onSend: () => {}, onValueChange: () => {}, value: '' }
  const { rerender } = render(<TooltipProvider><AuthoringConversation {...props} busy={false} /></TooltipProvider>)
  scroll.mockClear()
  rerender(<TooltipProvider><AuthoringConversation {...props} busy /></TooltipProvider>)
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'end' })
  expect(scroll.mock.contexts[0]).toBe(screen.getByRole('log').lastElementChild)
})

it('keeps typing and dictation usable while only sending is blocked, with thinking inside the transcript', async () => {
  class Recognition {
    start() {}
    stop() {}
  }
  vi.stubGlobal('SpeechRecognition', Recognition)
  const user = userEvent.setup()
  const onSend = vi.fn()
  render(<ConversationHarness busy onSend={onSend} />)
  const input = screen.getByRole('textbox')
  expect(input).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled()
  await user.type(input, 'Next instruction')
  await user.keyboard('{Enter}')
  expect(onSend).not.toHaveBeenCalled()
  expect(input).toHaveValue('Next instruction')
  expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled()
  const log = screen.getByRole('log', { name: 'Conversation' })
  expect(within(log).getByText('LEAI')).toBeInTheDocument()
  expect(within(log).getByRole('status')).toBeInTheDocument()
})

it('consumes submitted dictated text without stopping continuous recording', async () => {
  let recognition!: Recognition
  class Recognition {
    continuous = false
    interimResults = false
    lang = ''
    onresult: ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null
    start() { recognition = this }
    stop = vi.fn()
  }
  vi.stubGlobal('SpeechRecognition', Recognition)
  const user = userEvent.setup()
  function DictationHarness() {
    const [value, setValue] = useState('')
    const [busy, setBusy] = useState(false)
    return <TooltipProvider><AuthoringConversation busy={busy} disabled={false} messages={[]}
      onSend={(consumeTranscript) => { consumeTranscript(); setValue(''); setBusy(true) }} onValueChange={setValue} value={value} /></TooltipProvider>
  }
  render(<DictationHarness />)
  await user.click(screen.getByRole('button', { name: 'Dictate' }))
  const result = (text: string) => ({ isFinal: true, 0: { transcript: text } })
  act(() => recognition.onresult?.({ results: [result('Submitted speech')] }))
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(screen.getByRole('textbox')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Stop dictation' })).toBeEnabled()
  act(() => recognition.onresult?.({ results: [result('Submitted speech'), result('New speech')] }))
  expect(screen.getByRole('textbox')).toHaveValue('New speech')
  expect(recognition.stop).not.toHaveBeenCalled()
})

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
