import { useEffect, useRef, useState } from 'react'
import type { ChatVoiceInput } from './ChatComposer'

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
type RecognitionEvent = { results: ArrayLike<RecognitionResult> }
type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type RecognitionConstructor = new () => Recognition

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

export function useChatVoiceInput({ value, onValueChange, disabled, contextKey, maxLength = 3000,
  stoppedMessage = 'Voice input stopped. You can still type your message.',
  unavailableMessage = 'Voice input is unavailable. Please type your message.' }: {
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
  contextKey?: string
  maxLength?: number
  stoppedMessage?: string
  unavailableMessage?: string
}): { voiceInput: ChatVoiceInput; error: string } {
  const recognition = useRef<Recognition | null>(null)
  const speechBase = useRef('')
  const onValueChangeRef = useRef(onValueChange)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { onValueChangeRef.current = onValueChange }, [onValueChange])

  useEffect(() => () => {
    const active = recognition.current
    if (active) { recognition.current = null; active.stop() }
  }, [contextKey])
  useEffect(() => {
    if (disabled && recognition.current) {
      const active = recognition.current
      recognition.current = null
      active.stop()
    }
  }, [disabled])

  function toggle() {
    if (listening) {
      const active = recognition.current
      recognition.current = null
      active?.stop()
      setListening(false)
      return
    }
    const Recognition = recognitionConstructor()
    if (!Recognition || disabled) return
    setError('')
    speechBase.current = value.trim()
    const instance = new Recognition()
    instance.continuous = true
    instance.interimResults = true
    instance.lang = navigator.language || 'en-US'
    instance.onresult = (event) => {
      if (recognition.current !== instance) return
      let finalText = ''
      let interimText = ''
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      onValueChangeRef.current([speechBase.current, finalText.trim(), interimText.trim()].filter(Boolean).join(' ').slice(0, maxLength))
    }
    instance.onerror = () => {
      if (recognition.current !== instance) return
      recognition.current = null
      setError(stoppedMessage)
      setListening(false)
    }
    instance.onend = () => {
      if (recognition.current === instance) recognition.current = null
      if (!recognition.current) setListening(false)
    }
    recognition.current = instance
    try { instance.start(); setListening(true) }
    catch { recognition.current = null; setError(unavailableMessage) }
  }

  return {
    voiceInput: {
      active: listening,
      available: Boolean(recognitionConstructor()),
      disabled,
      onToggle: toggle,
      unsupportedMessage: 'Voice input is not supported in this browser',
    },
    error,
  }
}
