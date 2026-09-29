import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { useChatVoiceInput } from './useChatVoiceInput'

afterEach(() => vi.unstubAllGlobals())

it('dictates into the shared composer and stops when the conversation changes', () => {
  type Result = { isFinal: boolean; 0: { transcript: string } }
  const instances: FakeRecognition[] = []
  class FakeRecognition {
    continuous = false
    interimResults = false
    lang = ''
    onresult: ((event: { results: Result[] }) => void) | null = null
    onerror: (() => void) | null = null
    onend: (() => void) | null = null
    start = vi.fn()
    stop = vi.fn(() => this.onend?.())
    constructor() { instances.push(this) }
  }
  vi.stubGlobal('SpeechRecognition', FakeRecognition)

  const { result, rerender, unmount } = renderHook(({ contextKey }) => {
    const [value, setValue] = useState('Earlier text')
    return { value, ...useChatVoiceInput({ value, onValueChange: setValue, disabled: false, contextKey }) }
  }, { initialProps: { contextKey: 'chat-one' } })

  expect(result.current.voiceInput.available).toBe(true)
  act(() => result.current.voiceInput.onToggle())
  expect(instances[0]?.start).toHaveBeenCalledOnce()
  expect(result.current.voiceInput.active).toBe(true)
  act(() => instances[0]?.onresult?.({ results: [{ isFinal: true, 0: { transcript: ' a spoken answer' } }] }))
  expect(result.current.value).toBe('Earlier text a spoken answer')

  rerender({ contextKey: 'chat-two' })
  expect(instances[0]?.stop).toHaveBeenCalledOnce()
  expect(result.current.voiceInput.active).toBe(false)
  unmount()
})
