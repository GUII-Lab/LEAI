import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { WizardConversationMessage } from '@/api/contracts/wizard'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatTranscript } from '@/components/chat/ChatTranscript'
import { InfoPopover } from '@/components/product/InfoPopover'
import '@/app/student-legacy.css'

export function AuthoringConversation({ messages, value, onValueChange, onSend, busy, disabled }: {
  messages: WizardConversationMessage[]
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  busy: boolean
  disabled: boolean
}) {
  const [keyboardHintOpen, setKeyboardHintOpen] = useState(false)
  const keyboardHintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (keyboardHintTimeout.current) clearTimeout(keyboardHintTimeout.current)
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (value.trim() && !disabled && !busy) onSend()
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229 || event.key !== 'Enter') return
    const mobileViewport = window.innerWidth < 640
    const input = event.currentTarget
    if (!mobileViewport && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      const start = input.selectionStart
      const end = input.selectionEnd
      onValueChange(`${value.slice(0, start)}\n${value.slice(end)}`)
      window.setTimeout(() => input.setSelectionRange(start + 1, start + 1), 0)
      return
    }
    if (!mobileViewport && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      if (!value.trim() || disabled || busy) return
      setKeyboardHintOpen(false)
      if (keyboardHintTimeout.current) clearTimeout(keyboardHintTimeout.current)
      keyboardHintTimeout.current = setTimeout(() => setKeyboardHintOpen(false), 8000)
      window.setTimeout(() => setKeyboardHintOpen(true), 40)
      input.form?.requestSubmit()
    }
  }
  return <section aria-label="AI collaboration" className="legacy-student flex min-h-[30rem] flex-col overflow-hidden border-b border-border bg-[#fbfcfc] xl:h-full xl:border-r xl:border-b-0">
    <header className="border-b border-border px-4 py-3">
      <h3 className="font-semibold">Design together</h3>
      <p className="text-sm text-muted-foreground">Describe the change you want. The draft updates after validation.</p>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <ChatTranscript className="student-transcript mx-auto flex w-full max-w-[832px] flex-col gap-7 px-5 py-10 sm:gap-8 sm:px-0 sm:py-12">
        {messages.map((message) => message.role === 'user'
          ? <ChatMessage author="You" className="student-user-message" key={message.id} metaClassName="student-message-meta" role="user" timestamp={message.created_at}>
              <p className="w-full max-w-[83%] whitespace-pre-wrap break-words rounded bg-muted px-5 py-4 text-base leading-7">{message.content}</p>
            </ChatMessage>
          : <ChatMessage author="LEAI" className="student-assistant-message" key={message.id} metaClassName="student-message-meta" role="assistant" timestamp={message.created_at}>
              <div className="ml-1 border-l border-border/60 py-0.5 pl-7">
                {message.content.split('\n').map((line, index) => <p className="min-h-[1em] whitespace-pre-wrap break-words text-base leading-[1.7]" key={index}>{line}</p>)}
              </div>
            </ChatMessage>)}
      </ChatTranscript>
      {messages.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-base leading-relaxed">
        <strong>Build with AI when you need it</strong><p className="mt-2 text-muted-foreground">Ask for a rewrite, a new question, a reorganization, or a deletion. Every applied change is saved in History.</p>
      </div>}
      {busy && <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">LEAI is reviewing the draft…</p>}
    </div>
    <form className="student-chat-footer shrink-0 border-t border-border/50 bg-card px-4 py-3 sm:px-6 sm:py-4" onSubmit={submit}>
      <div className="mx-auto max-w-[832px]">
        <ChatComposer busy={busy} disabled={disabled || busy} inputLabel="Ask LEAI to edit this feedback draft"
          maxLength={3000} onKeyDown={handleComposerKeyDown} onValueChange={onValueChange} placeholder="Ask for a change to the draft…"
          sendHint={{ content: <span>Enter sends. <kbd data-slot="kbd">⌘+Enter</kbd> or <kbd data-slot="kbd">Ctrl+Enter</kbd> adds a new line. Shift+Enter also works.</span>,
            open: keyboardHintOpen, onOpenChange: setKeyboardHintOpen }}
          sendDisabled={!value.trim()} value={value} />
        <div className="mt-2 flex items-center justify-end gap-2 text-sm text-muted-foreground">AI collaborator <InfoPopover label="What AI can use" variant="builder">LEAI can use this draft, authorized templates, and course context. It cannot access student rosters, grades, or other courses.</InfoPopover></div>
      </div>
    </form>
  </section>
}
