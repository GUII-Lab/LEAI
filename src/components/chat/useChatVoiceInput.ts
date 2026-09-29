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
}): { voiceInput: ChatVoiceInput; error: string; resetTranscript: () => void } {
  const recognition = useRef<Recognition | null>(null)
  const speechBase = useRef('')
  const lastResults = useRef<string[]>([])
  const consumed = useRef<string[]>([])
  const currentValue = useRef(value)
  const lastPublished = useRef(value)
  const wantsListening = useRef(false)
  const onValueChangeRef = useRef(onValueChange)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { onValueChangeRef.current = onValueChange }, [onValueChange])
  useEffect(() => { currentValue.current = value }, [value])

  useEffect(() => () => {
    wantsListening.current = false
    const active = recognition.current
    if (active) { recognition.current = null; active.stop() }
    setListening(false)
  }, [contextKey])
  useEffect(() => {
    if (disabled && recognition.current) {
      wantsListening.current = false
      const active = recognition.current
      recognition.current = null
      active.stop()
      setListening(false)
    }
  }, [disabled])

  function toggle() {
    if (wantsListening.current) {
      wantsListening.current = false
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
    lastPublished.current = value
    lastResults.current = []
    consumed.current = []
    wantsListening.current = true
    const instance = new Recognition()
    instance.continuous = true
    instance.interimResults = true
    instance.lang = navigator.language || 'en-US'
    const words = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(instance.lang, { granularity: 'word' }) : null
    instance.onresult = (event) => {
      if (recognition.current !== instance) return
      if (currentValue.current !== lastPublished.current) {
        speechBase.current = currentValue.current.trim()
        consumed.current = [...lastResults.current]
      }
      const parts: string[] = []
      const results: string[] = []
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0].transcript
        results.push(transcript)
        const previous = consumed.current[index]
        // Recognition sends cumulative results. Already submitted segments must
        // never reappear, including interim segments that later become final.
        const suffix = previous !== undefined && transcript.startsWith(previous) ? transcript.slice(previous.length) : ''
        const atWordBoundary = suffix && previous !== undefined && words
          && [...words.segment(transcript)].some(word => word.index === previous.length)
        parts.push(previous === undefined ? transcript : /^\s/.test(suffix) || atWordBoundary ? suffix : '')
      }
      lastResults.current = results
      const next = [speechBase.current, ...parts.map(part => part.trim())].filter(Boolean).join(' ').slice(0, maxLength)
      currentValue.current = next
      lastPublished.current = next
      onValueChangeRef.current(next)
    }
    instance.onerror = () => {
      if (recognition.current !== instance) return
      recognition.current = null
      wantsListening.current = false
      setError(stoppedMessage)
      setListening(false)
    }
    instance.onend = () => {
      if (recognition.current !== instance || !wantsListening.current) return
      speechBase.current = currentValue.current.trim()
      consumed.current = []
      lastResults.current = []
      try { instance.start() }
      catch { recognition.current = null; wantsListening.current = false; setListening(false); setError(unavailableMessage) }
    }
    recognition.current = instance
    try { instance.start(); setListening(true) }
    catch { recognition.current = null; wantsListening.current = false; setListening(false); setError(unavailableMessage) }
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
    resetTranscript: () => {
      consumed.current = [...lastResults.current]
      speechBase.current = ''
      currentValue.current = ''
      lastPublished.current = ''
    },
  }
}
