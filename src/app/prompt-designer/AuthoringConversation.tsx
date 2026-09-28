import type { FormEvent } from 'react'
import type { WizardConversationMessage } from '@/api/contracts/wizard'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatTranscript } from '@/components/chat/ChatTranscript'

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
  return <section aria-label="AI collaboration" className="flex min-h-[30rem] flex-col overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-0 xl:h-[calc(100dvh-18rem)] xl:max-h-[38rem]">
    <header className="border-b border-border px-4 py-3">
      <h3 className="font-semibold">Design together</h3>
      <p className="text-sm text-muted-foreground">Describe the change you want. The draft updates after validation.</p>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <ChatTranscript>{messages.map((message) => <ChatMessage author={message.role === 'assistant' ? 'LEAI' : 'You'}
            key={message.id} role={message.role} timestamp={message.created_at}>
            <div className={message.role === 'user' ? 'max-w-[90%] rounded-xl bg-muted px-3 py-2' : 'max-w-full whitespace-pre-wrap leading-relaxed'}>
              {message.content}
            </div>
          </ChatMessage>)}</ChatTranscript>
      {messages.length === 0 && <p className="text-base text-muted-foreground">Try “make the questions shorter” or “add one question about course support.”</p>}
      {busy && <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">LEAI is reviewing the draft…</p>}
    </div>
    <form className="border-t border-border p-3" onSubmit={submit}>
      <ChatComposer busy={busy} disabled={disabled || busy} inputLabel="Ask LEAI to edit this feedback draft"
        maxLength={3000} onValueChange={onValueChange} placeholder="Ask for a change to the draft…"
        sendDisabled={!value.trim()} value={value} />
    </form>
  </section>
}
