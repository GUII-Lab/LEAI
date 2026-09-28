import type { FormEvent } from 'react'
import type { WizardConversationMessage } from '@/api/contracts/wizard'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatTranscript } from '@/components/chat/ChatTranscript'
import '@/app/student-legacy.css'

export function AuthoringConversation({ messages, value, onValueChange, onSend, busy, disabled }: {
  messages: WizardConversationMessage[]
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  busy: boolean
  disabled: boolean
}) {
  function submit(event: FormEvent) {
    event.preventDefault()
    if (value.trim() && !disabled && !busy) onSend()
  }
  return <section aria-label="AI collaboration" className="legacy-student flex min-h-[30rem] flex-col overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-0 xl:h-[calc(100dvh-18rem)] xl:max-h-[38rem]">
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
      {messages.length === 0 && <p className="text-base text-muted-foreground">Try “make the questions shorter” or “add one question about course support.”</p>}
      {busy && <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">LEAI is reviewing the draft…</p>}
    </div>
    <form className="student-chat-footer shrink-0 border-t border-border/50 bg-card px-4 py-3 sm:px-6 sm:py-4" onSubmit={submit}>
      <div className="mx-auto max-w-[832px]">
        <ChatComposer busy={busy} disabled={disabled || busy} inputLabel="Ask LEAI to edit this feedback draft"
          maxLength={3000} onValueChange={onValueChange} placeholder="Ask for a change to the draft…"
          sendDisabled={!value.trim()} value={value} />
      </div>
    </form>
  </section>
}
