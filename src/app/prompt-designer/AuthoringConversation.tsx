import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { WizardConversationMessage } from '@/api/contracts/wizard'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatTranscript } from '@/components/chat/ChatTranscript'
import { ChatThinkingMessage } from '@/components/chat/ChatThinkingMessage'
import { useChatVoiceInput } from '@/components/chat/useChatVoiceInput'
import { InfoPopover } from '@/components/product/InfoPopover'
import '@/app/student-legacy.css'

export function AuthoringConversation({ messages, value, onValueChange, onSend, busy, disabled, failedMessageIds = [] }: {
  messages: WizardConversationMessage[]
  value: string
  onValueChange: (value: string) => void
  onSend: (consumeTranscript: () => void) => void
  busy: boolean
  disabled: boolean
  failedMessageIds?: string[]
}) {
  const [keyboardHintOpen, setKeyboardHintOpen] = useState(false)
  const keyboardHintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptEnd = useRef<HTMLLIElement>(null)
  const lastMessage = messages.at(-1)
  const voice = useChatVoiceInput({ value, onValueChange, disabled })
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView?.({ block: 'end' })
  }, [messages.length, lastMessage?.id, lastMessage?.content, busy])
  useEffect(() => () => {
    if (keyboardHintTimeout.current) clearTimeout(keyboardHintTimeout.current)
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (value.trim() && !disabled && !busy) onSend(voice.resetTranscript)
  }

  function showKeyboardHint() {
    setKeyboardHintOpen(false)
    if (keyboardHintTimeout.current) clearTimeout(keyboardHintTimeout.current)
    keyboardHintTimeout.current = setTimeout(() => setKeyboardHintOpen(false), 8000)
    window.setTimeout(() => setKeyboardHintOpen(true), 40)
  }
  return <section aria-label="AI collaboration" className="legacy-student flex min-h-[30rem] flex-col overflow-hidden border-b border-border bg-[#fbfcfc] xl:h-full xl:border-r xl:border-b-0">
    <header className="border-b border-border px-4 py-3">
      <h3 className="font-semibold">Design together</h3>
      <p className="text-sm text-muted-foreground">Describe the change you want. The draft updates after validation.</p>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <ChatTranscript endAnchorRef={transcriptEnd} className="student-transcript mx-auto flex w-full max-w-[832px] flex-col gap-7 px-5 py-10 sm:gap-8 sm:px-0 sm:py-12">
        {messages.map((message) => message.role === 'user'
          ? <ChatMessage author="You" className="student-user-message" key={message.id} metaClassName="student-message-meta" role="user" timestamp={message.created_at}>
              <p className="w-full max-w-[83%] whitespace-pre-wrap break-words rounded bg-muted px-5 py-4 text-base leading-7">{message.content}</p>
              {failedMessageIds.includes(message.id) && <p role="alert">Send not confirmed. Review the saved conversation before retrying.</p>}
            </ChatMessage>
          : <ChatMessage author="LEAI" className="student-assistant-message" key={message.id} metaClassName="student-message-meta" role="assistant" timestamp={message.created_at}>
              <div className="ml-1 border-l border-border/60 py-0.5 pl-7">
                {message.content.split('\n').map((line, index) => <p className="min-h-[1em] whitespace-pre-wrap break-words text-base leading-[1.7]" key={index}>{line}</p>)}
              </div>
            </ChatMessage>)}
        {busy && <ChatThinkingMessage />}
      </ChatTranscript>
      {messages.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-base leading-relaxed">
        <strong>Build with AI when you need it</strong><p className="mt-2 text-muted-foreground">Ask for a rewrite, a new question, a reorganization, or a deletion. Every applied change is saved in History.</p>
      </div>}
    </div>
    <form className="student-chat-footer shrink-0 border-t border-border/50 bg-card px-4 py-3 sm:px-6 sm:py-4" onSubmit={submit}>
      <div className="mx-auto max-w-[832px]">
        <ChatComposer busy={busy} disabled={disabled} inputLabel="Ask LEAI to edit this feedback draft"
          maxLength={3000} onEnterSend={showKeyboardHint} onValueChange={onValueChange} placeholder="Ask for a change to the draft…"
          sendHint={{ content: <span>Enter sends. <kbd data-slot="kbd">⌘+Enter</kbd> or <kbd data-slot="kbd">Ctrl+Enter</kbd> adds a new line. Shift+Enter also works.</span>,
            open: keyboardHintOpen, onOpenChange: setKeyboardHintOpen }}
          sendDisabled={!value.trim()} value={value} voiceInput={voice.voiceInput} />
        {voice.error && <p className="mt-2 text-sm text-destructive" role="alert">{voice.error}</p>}
        <div className="mt-2 flex items-center justify-end gap-2 text-sm text-muted-foreground">AI collaborator <InfoPopover label="What AI can use" variant="builder">LEAI can use this draft, authorized templates, and course context. It cannot access student rosters, grades, or other courses.</InfoPopover></div>
      </div>
    </form>
  </section>
}
