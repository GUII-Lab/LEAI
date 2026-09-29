import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { useChatVoiceInput } from './useChatVoiceInput'

afterEach(() => vi.unstubAllGlobals())

it('keeps recording across submissions without replaying sent speech or overwriting edits', () => {
  let instance: FakeRecognition
  class FakeRecognition {
    continuous = true; interimResults = true; lang = ''
    onresult: ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    start = vi.fn(); stop = vi.fn(() => this.onend?.())
    constructor() { instance = this }
  }
  vi.stubGlobal('SpeechRecognition', FakeRecognition)
  const { result } = renderHook(() => {
    const [value, setValue] = useState('')
    return { value, setValue, ...useChatVoiceInput({ value, onValueChange: setValue, disabled: false }) }
  })
  act(() => result.current.voiceInput.onToggle())
  const speak = (words: string[]) => act(() => instance.onresult?.({ results: words.map(transcript => ({ isFinal: true, 0: { transcript } })) }))
  speak(['first answer'])
  expect(result.current.value).toBe('first answer')
  act(() => { result.current.resetTranscript(); result.current.setValue('') })
  speak(['first answer', 'next answer'])
  expect(result.current.value).toBe('next answer')
  expect(result.current.voiceInput.active).toBe(true)
  expect(instance!.stop).not.toHaveBeenCalled()
  act(() => result.current.setValue('edited next answer'))
  speak(['first answer', 'next answer', 'more detail'])
  expect(result.current.value).toBe('edited next answer more detail')
  act(() => instance.onend?.())
  expect(instance!.start).toHaveBeenCalledTimes(2)
  expect(result.current.voiceInput.active).toBe(true)
  act(() => result.current.voiceInput.onToggle())
  expect(instance!.start).toHaveBeenCalledTimes(2)
})

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

it('does not resurrect a submitted interim result when recognition corrects it', () => {
  let resultHandler: ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null
  class Recognition {
    continuous = true; interimResults = true; lang = ''
    set onresult(handler: typeof resultHandler) { resultHandler = handler }
    onend = null; onerror = null; start() {}; stop() {}
  }
  vi.stubGlobal('SpeechRecognition', Recognition)
  const { result } = renderHook(() => {
    const [value, setValue] = useState('')
    return { value, setValue, ...useChatVoiceInput({ value, onValueChange: setValue, disabled: false }) }
  })
  act(() => result.current.voiceInput.onToggle())
  act(() => resultHandler?.({ results: [{ isFinal: false, 0: { transcript: 'I plan' } }] }))
  act(() => { result.current.resetTranscript(); result.current.setValue('') })
  act(() => resultHandler?.({ results: [{ isFinal: true, 0: { transcript: 'I planned' } }, { isFinal: false, 0: { transcript: 'next thought' } }] }))
  expect(result.current.value).toBe('next thought')
  act(() => result.current.voiceInput.onToggle())
  act(() => result.current.setValue(''))
  act(() => result.current.voiceInput.onToggle())
  act(() => resultHandler?.({ results: [{ isFinal: false, 0: { transcript: '你好' } }] }))
  act(() => { result.current.resetTranscript(); result.current.setValue('') })
  act(() => resultHandler?.({ results: [{ isFinal: false, 0: { transcript: '你好世界' } }] }))
  expect(result.current.value).toBe('世界')
})
