import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { ChatComposer } from './ChatComposer'

afterEach(() => vi.unstubAllGlobals())
function Harness({ busy = false, onSend = vi.fn(), onToggle = vi.fn() }) {
  const [value, setValue] = useState('first')
  return <form onSubmit={(event) => { event.preventDefault(); onSend() }}>
    <ChatComposer value={value} onValueChange={setValue} placeholder="Message" disabled={false}
      sendDisabled={!value.trim()} busy={busy} voiceInput={{ active: true, available: true, disabled: false, onToggle }} />
  </form>
}
it('returns microphone focus to typing and Enter sends without toggling dictation', async () => {
  const user = userEvent.setup(), onSend = vi.fn(), onToggle = vi.fn()
  render(<Harness onSend={onSend} onToggle={onToggle} />)
  await user.click(screen.getByRole('button', { name: 'Stop dictation' }))
  expect(screen.getByRole('textbox')).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(onSend).toHaveBeenCalledOnce()
  expect(onToggle).toHaveBeenCalledOnce()
})
it('blocks sending but preserves typing and modifier newlines while waiting', async () => {
  const user = userEvent.setup(), onSend = vi.fn()
  render(<Harness busy onSend={onSend} />)
  const input = screen.getByRole('textbox')
  await user.click(input)
  await user.keyboard('{Enter}{Control>}{Enter}{/Control}next')
  expect(input).toHaveValue('first\nnext')
  expect(onSend).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Stop dictation' })).toBeEnabled()
})
it('keeps mobile Enter and IME Enter from sending', async () => {
  const user = userEvent.setup(), onSend = vi.fn()
  vi.stubGlobal('innerWidth', 390)
  render(<Harness onSend={onSend} />)
  const input = screen.getByRole('textbox')
  await user.click(input)
  await user.keyboard('{Enter}')
  expect(input).toHaveValue('first\n')
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 })
  expect(onSend).not.toHaveBeenCalled()
})

it('preserves keyboard activation of microphone controls and desktop IME composition', async () => {
  const user = userEvent.setup(), onSend = vi.fn(), onToggle = vi.fn()
  render(<Harness onSend={onSend} onToggle={onToggle} />)
  const input = screen.getByRole('textbox')
  await user.click(input)
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
  expect(onSend).not.toHaveBeenCalled()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Stop dictation' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(onToggle).toHaveBeenCalledOnce()
  expect(onSend).not.toHaveBeenCalled()
})
