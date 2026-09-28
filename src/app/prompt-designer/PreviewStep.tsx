import { useState, type FormEvent } from 'react'
import type { WizardPreview, WizardRevision } from '@/api/contracts/wizard'
import { Button } from '@/components/ui/button'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatTranscript } from '@/components/chat/ChatTranscript'

export function PreviewStep({ revision, preview, onLaunch, onAnswer, onDecision, busy }: {
  revision: WizardRevision
  preview: WizardPreview | null
  onLaunch: () => void
  onAnswer: (itemId: string, content: string) => void
  onDecision: (value: 'completed' | 'skipped') => void
  busy: boolean
}) {
  const [value, setValue] = useState('')
  const items = revision.body.sections.flatMap((section) => section.items)
  const answered = preview?.messages.filter((message) => message.role === 'student') ?? []
  const next = items[answered.length]
  function submit(event: FormEvent) {
    event.preventDefault()
    if (next && value.trim() && !busy) {
      onAnswer(next.id, value.trim())
      setValue('')
    }
  }
  return <div className="mx-auto max-w-3xl space-y-5">
    <div>
      <h3 className="text-xl font-semibold">Preview the student experience</h3>
      <p className="mt-1 text-base text-muted-foreground">This practice conversation stays separate from student feedback and Analyzer counts.</p>
    </div>
    {revision.preview_decision
      ? <p role="status" className="rounded-lg border border-border bg-muted/50 p-4">Preview {revision.preview_decision} for this exact revision.</p>
      : <>
        {!preview && <Button disabled={busy} onClick={onLaunch} type="button">Open student preview</Button>}
        {preview && <section aria-label="Student preview" className="rounded-xl border border-border bg-card p-4">
          <ChatTranscript>{preview.messages.map((message) => <ChatMessage author={message.role === 'student' ? 'Student preview' : 'LEAI'}
            key={message.id} role={message.role === 'student' ? 'user' : 'assistant'} timestamp={message.created_at}>
            <p className={message.role === 'student' ? 'rounded-xl bg-muted px-3 py-2' : 'py-2'}>{message.content}</p>
          </ChatMessage>)}</ChatTranscript>
          {next ? <form className="mt-3" onSubmit={submit}>
            <ChatComposer busy={busy} disabled={busy} inputLabel="Preview answer" onValueChange={setValue}
              placeholder="Reply as a student to try this question…" sendDisabled={!value.trim()} value={value} />
          </form> : <div className="mt-4 space-y-3">
            <p>All {items.length} questions were answered in this isolated preview.</p>
            <Button disabled={busy} onClick={() => onDecision('completed')} type="button">Complete preview</Button>
          </div>}
        </section>}
        <div className="border-t border-border pt-4">
          <Button disabled={busy} onClick={() => onDecision('skipped')} type="button" variant="outline">Skip preview for this revision</Button>
        </div>
      </>}
  </div>
}
