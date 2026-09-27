import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Link2, LockKeyhole } from 'lucide-react'
import type { StudentSession, StudentSurvey } from '@/api/student'
import { Button } from '@/components/ui/button'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatTranscript } from '@/components/chat/ChatTranscript'
import { StudentConsentDialog } from './StudentConsentDialog'
import './student-legacy.css'

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> }
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
  const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

export function StudentConversation({ survey, session, text, onTextChange, rating, onRatingChange, onSubmit,
  onSkip, onStart, onCopyResume, onDownloadDocument, busy, verified, error, conflictAction, debugDisclosure, termsHref, privacyHref }: {
  survey?: StudentSurvey
  session: StudentSession | null
  text: string
  onTextChange: (value: string) => void
  rating: number | null
  onRatingChange: (value: number) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSkip: () => void
  onStart: (researchConsent: boolean) => void
  onCopyResume: () => void
  onDownloadDocument: () => void
  busy: boolean
  verified: boolean
  error: string
  conflictAction?: ReactNode
  debugDisclosure?: ReactNode
  termsHref: string
  privacyHref: string
}) {
  const transcriptEnd = useRef<HTMLLIElement>(null)
  const recognition = useRef<Recognition | null>(null)
  const speechBase = useRef('')
  const previousLatestAssistantId = useRef<number | null>(null)
  const keyboardHintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const arrivalTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [keyboardHintOpen, setKeyboardHintOpen] = useState(false)
  const [highlightedAssistantId, setHighlightedAssistantId] = useState<number | null>(null)
  const [headerPointerInside, setHeaderPointerInside] = useState(false)
  const [headerFocused, setHeaderFocused] = useState(false)
  const [headerPinned, setHeaderPinned] = useState(false)
  const [downloadsPointerInside, setDownloadsPointerInside] = useState(false)
  const [downloadsFocused, setDownloadsFocused] = useState(false)
  const [downloadsPinned, setDownloadsPinned] = useState(false)
  const prompt = session?.prompt
  const messages = session?.messages ?? []
  const hasStudentResponse = messages.some((message) => message.role === 'student')
  const headerExpanded = !hasStudentResponse || headerPointerInside || headerFocused || headerPinned
  const downloadsExpanded = !hasStudentResponse || downloadsPointerInside || downloadsFocused || downloadsPinned
  useEffect(() => {
    if (session && messages.length) transcriptEnd.current?.scrollIntoView?.({ block: 'end' })
  }, [session, messages.length])
  useEffect(() => () => {
    recognition.current?.stop()
    if (keyboardHintTimeout.current) clearTimeout(keyboardHintTimeout.current)
    if (arrivalTimeout.current) clearTimeout(arrivalTimeout.current)
  }, [])

  function toggleVoice() {
    if (listening) {
      recognition.current?.stop()
      return
    }
    const Recognition = recognitionConstructor()
    if (!Recognition) return
    setVoiceError('')
    speechBase.current = text.trim()
    const instance = new Recognition()
    instance.continuous = true
    instance.interimResults = true
    instance.lang = navigator.language || 'en-US'
    instance.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      onTextChange([speechBase.current, finalText, interimText].filter(Boolean).join(' ').slice(0, 3000))
    }
    instance.onerror = () => { setVoiceError('Voice input stopped. You can still type your answer.'); setListening(false) }
    instance.onend = () => setListening(false)
    recognition.current = instance
    try { instance.start(); setListening(true) } catch { setVoiceError('Voice input is unavailable. Please type your answer.') }
  }

  function showKeyboardHint() {
    const key = 'leai:student-enter-hint-count'
    let seen = 0
    try { seen = Number(window.localStorage.getItem(key) ?? 0) || 0 } catch { /* Storage can be disabled. */ }
    if (seen >= 2) return
    try { window.localStorage.setItem(key, String(seen + 1)) } catch { /* Still show the hint for this use. */ }
    setKeyboardHintOpen(false)
    if (keyboardHintTimeout.current) clearTimeout(keyboardHintTimeout.current)
    keyboardHintTimeout.current = setTimeout(() => setKeyboardHintOpen(false), 8000)
    setTimeout(() => setKeyboardHintOpen(true), 40)
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229 || event.key !== 'Enter') return
    const mobileViewport = window.innerWidth < 640
    const input = event.currentTarget
    if (!mobileViewport && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      const start = input.selectionStart
      const end = input.selectionEnd
      onTextChange(`${text.slice(0, start)}\n${text.slice(end)}`)
      setTimeout(() => input.setSelectionRange(start + 1, start + 1), 0)
      return
    }
    if (!mobileViewport && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      if (!text.trim()) return
      showKeyboardHint()
      input.form?.requestSubmit()
    }
  }

  const currentPromptText = prompt && prompt.phase !== 'complete' ? prompt.text : null
  const activePromptMessage = !messages.length || (messages.at(-1)?.role === 'assistant' && messages.at(-1)?.content === currentPromptText)
  const shownMessages = session ? messages.length ? messages.filter((message) => message.role !== 'system') : [
    { id: -1, sequence: 1, role: 'assistant' as const, content: survey?.intro ?? '', attribution: { phase: 'intro' } },
    ...(prompt && prompt.phase !== 'complete' ? [{ id: -2, sequence: 2, role: 'assistant' as const,
      content: prompt.text, attribution: { item_id: prompt.item_id, phase: prompt.phase } }] : []),
  ] : []
  if (shownMessages.length >= 2 && shownMessages[0].role === 'assistant' && shownMessages[0].attribution.phase === 'intro'
    && shownMessages[1].role === 'assistant') {
    shownMessages.splice(0, 2, { ...shownMessages[1], content: `${shownMessages[0].content}\n${shownMessages[1].content}` })
  }
  const latestAssistantId = [...shownMessages].reverse().find((message) => message.role === 'assistant')?.id
  useEffect(() => {
    const previousId = previousLatestAssistantId.current
    previousLatestAssistantId.current = latestAssistantId ?? null
    if (previousId === null || latestAssistantId === undefined || previousId === latestAssistantId) return
    setHighlightedAssistantId(latestAssistantId)
    if (arrivalTimeout.current) clearTimeout(arrivalTimeout.current)
    arrivalTimeout.current = setTimeout(() => setHighlightedAssistantId(null), 1600)
  }, [latestAssistantId])
  return <main className="legacy-student flex h-dvh min-h-0 min-w-0 flex-col bg-card text-foreground" data-testid="student-chat-shell">
    <div className={`student-chrome-region student-header-region${hasStudentResponse ? ` ${headerExpanded ? 'is-open' : 'is-collapsed'}` : ''}`}
      data-testid="student-header-region"
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHeaderPointerInside(true) }}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHeaderPointerInside(false) }}
      onFocusCapture={() => setHeaderFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeaderFocused(false) }}>
    {hasStudentResponse && <Button aria-controls="student-chat-header" aria-expanded={headerExpanded} aria-label="Keep LEAI header visible" aria-pressed={headerPinned}
      className="student-chrome-toggle student-header-toggle" onClick={(event) => { setHeaderPinned((pinned) => !pinned); if (event.detail > 0) setHeaderFocused(false) }} size="icon" type="button" variant="ghost">
      {headerExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
    </Button>}
    <header aria-hidden={hasStudentResponse && !headerExpanded} className="student-chat-header flex min-h-[77px] shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 py-3 sm:px-8" id="student-chat-header" inert={hasStudentResponse && !headerExpanded}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-xs font-extrabold tracking-[0.12em] text-primary">LEAI</span>
        <span className="hidden h-5 border-l border-border sm:block" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium text-muted-foreground sm:text-base">{survey?.label ?? 'Reflection'}</h1>
          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">Your responses are anonymous</p>
        </div>
        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2 py-1 text-[10px] font-bold tracking-wide text-success sm:inline-flex"><LockKeyhole className="size-3" />ANONYMOUS</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a className="student-header-link" href={termsHref} rel="noopener noreferrer" target="_blank">Terms</a>
        <a className="student-header-link" href={privacyHref} rel="noopener noreferrer" target="_blank">Privacy</a>
        {session && <Button aria-label="Copy resume link" className="student-resume-button h-9 gap-1 rounded-md text-[11px] font-semibold uppercase tracking-wide" onClick={onCopyResume} size="sm" type="button" variant="outline"><Link2 className="size-3.5"/><span aria-hidden="true" className="hidden sm:inline">Copy resume link</span><span aria-hidden="true" className="sm:hidden">Resume</span></Button>}
      </div>
    </header>
    </div>
    <div className="student-progress shrink-0 border-b border-border/50 px-4 py-2 text-xs text-muted-foreground sm:px-3.5">
      {session?.progress_label ?? ''}
    </div>
    <section className="min-h-0 flex-1 overflow-y-auto bg-card" aria-label="Reflection messages">
      {!session ? null : <ChatTranscript className="student-transcript mx-auto flex w-full max-w-[832px] flex-col gap-7 px-5 py-10 sm:gap-8 sm:px-0 sm:py-12" endAnchorRef={transcriptEnd}>
        {shownMessages.map((message) => message.role === 'student' ?
          <ChatMessage author="You" className="student-user-message" key={message.id} metaClassName="student-message-meta" role="user" timestamp={message.created_at}>
            <p className="w-full max-w-[83%] whitespace-pre-wrap break-words rounded bg-muted px-5 py-4 text-[15px] leading-7">{message.content}</p>
          </ChatMessage> : <ChatMessage author="LEAI" className={`${message.id === highlightedAssistantId ? 'student-assistant-arrival ' : ''}student-assistant-message`} key={message.id} metaClassName="student-message-meta" role="assistant" timestamp={message.created_at}>
            <div className="ml-1 border-l border-border/60 py-0.5 pl-7">
              {message.content.split('\n').map((line, index) => <p className="min-h-[1em] whitespace-pre-wrap break-words text-[15px] leading-[1.7]" key={index}>{line}</p>)}
              {activePromptMessage && (message.id === messages.at(-1)?.id || (message.id === -2 && !messages.length)) && prompt && prompt.phase !== 'complete' && prompt.context_note &&
                <p className="mt-3 text-sm text-muted-foreground">{prompt.context_note}</p>}
              {message.id === latestAssistantId && debugDisclosure}
            </div>
          </ChatMessage>)}
      </ChatTranscript>}
    </section>
    <footer className="student-chat-footer shrink-0 border-t border-border/50 bg-card px-4 py-3 sm:px-6 sm:py-4">
      <div className="mx-auto max-w-[832px]">
        {session?.status !== 'completed' && <div aria-label="Revision tip" className="student-revise-hint" role="note">
          <span aria-hidden="true">✎</span>
          <span><strong>You can revise or add to any answer anytime.</strong> Just tell LEAI — for example,{' '}
            <em>“actually, change what I said about ...”</em>,{' '}
            <em>“I want to add to my answer about ...”</em>, or{' '}
            <em>“go back to your earlier question about ...”</em></span>
        </div>}
        {session?.status === 'completed' ? <p className="py-3 text-sm font-medium text-success">Reflection downloaded. This version is final.</p> : session && prompt ?
          <form onSubmit={onSubmit}>
            {prompt.phase === 'rating' ? <fieldset className="mb-3 flex flex-wrap gap-2">
              <legend className="mb-2 text-sm font-medium">Choose a rating</legend>
              {prompt.choices?.map((choice) => <label className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent" key={choice.value}>
                <input checked={rating === choice.value} className="mr-2 accent-primary" name="rating" onChange={() => onRatingChange(choice.value)} type="radio" value={choice.value} />{choice.label}
              </label>)}
            </fieldset> : null}
            <ChatComposer busy={busy} disabled={!verified} inputLabel="Message" onKeyDown={handleComposerKeyDown} onValueChange={onTextChange}
              placeholder="Share your thoughts about the class..." sendDisabled={prompt.phase === 'rating' ? rating === null : !text.trim()}
              sendHint={{ content: <span>Enter sends. <kbd data-slot="kbd">⌘+Enter</kbd> or <kbd data-slot="kbd">Ctrl+Enter</kbd> adds a new line. Shift+Enter also works.</span>,
                open: keyboardHintOpen, onOpenChange: setKeyboardHintOpen }} showInput={prompt.phase !== 'rating'} value={text}
              voiceInput={prompt.phase !== 'rating' ? { active: listening, available: Boolean(recognitionConstructor()), disabled: busy,
                onToggle: toggleVoice, unsupportedMessage: 'Voice input is not supported in this browser' } : undefined} />
            {prompt.phase === 'rating' && <Button className="mt-2" disabled={!verified || busy} onClick={onSkip} size="sm" type="button" variant="ghost">Prefer not to answer</Button>}
          </form> : <ChatComposer disabled sendDisabled value="" onValueChange={() => undefined} placeholder="Share your thoughts about the class..."
            voiceInput={{ active: false, available: false, disabled: true, onToggle: () => undefined }} />}
        {session && (survey?.completed_response_download_enabled || survey?.completion_certificate_enabled) &&
          <div className={`student-chrome-region student-download-region${hasStudentResponse ? ` ${downloadsExpanded ? 'is-open' : 'is-collapsed'}` : ''}`}
            data-testid="student-download-region"
            onPointerEnter={(event) => { if (event.pointerType === 'mouse') setDownloadsPointerInside(true) }}
            onPointerLeave={(event) => { if (event.pointerType === 'mouse') setDownloadsPointerInside(false) }}
            onFocusCapture={() => setDownloadsFocused(true)}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDownloadsFocused(false) }}>
          {hasStudentResponse && <Button aria-controls="reflection-downloads" aria-expanded={downloadsExpanded} aria-label="Keep reflection progress and downloads visible" aria-pressed={downloadsPinned}
            className="student-chrome-toggle student-download-toggle" id="reflection-downloads-toggle" onClick={(event) => { setDownloadsPinned((pinned) => !pinned); if (event.detail > 0) setDownloadsFocused(false) }} size="icon" type="button" variant="ghost">
            {downloadsExpanded ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
          </Button>}
          <div aria-hidden={hasStudentResponse && !downloadsExpanded} className="student-download-strip" id="reflection-downloads" inert={hasStudentResponse && !downloadsExpanded} role="group" aria-label="Reflection downloads">
            <span className="student-download-status"><strong>{prompt?.phase === 'complete' ? 'Reflection complete' : 'Reflection in progress'}</strong>{prompt?.phase !== 'complete' && <> · {session.progress_label}</>}</span>
            {survey.completed_response_download_enabled && <button onClick={onDownloadDocument} type="button">
              {prompt?.phase === 'complete' ? 'Download my reflection (Word / .docx)' : 'Save draft (.docx)'}
            </button>}
            {survey.completion_certificate_enabled && <button disabled type="button">
              {session.messages.some((message) => message.role === 'student')
                ? 'Certificate unavailable in this build' : 'Respond once to unlock your certificate'}
            </button>}
          </div>
          </div>}
        {(error || voiceError) && <p className="mt-2 text-sm text-destructive" role="alert">{error || voiceError}</p>}
        {conflictAction}
        {!verified && <p className="text-sm text-muted-foreground" role="status">Waiting for secure connection before accepting responses.</p>}
      </div>
    </footer>
    {!session && <StudentConsentDialog busy={busy} error={error} onContinue={onStart}
      privacyHref={privacyHref} termsHref={termsHref} verified={verified} />}
  </main>
}
