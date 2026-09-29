import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { createInstructorApi } from '@/api/instructor-v1'
import type { WizardPreview } from '@/api/contracts/wizard'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatTranscript } from '@/components/chat/ChatTranscript'
import { useChatVoiceInput } from '@/components/chat/useChatVoiceInput'
import { Button } from '@/components/ui/button'
import { qualifyBrowserKey, toAppHref, type PublicEnvironment } from '@/config/environment'

type Api = ReturnType<typeof createInstructorApi>

export function WizardPreviewPage({ api, environment }: { api: Api; environment: PublicEnvironment }) {
  const courseId = sessionStorage.getItem(qualifyBrowserKey(environment.name, 'selected-course')) ?? ''
  const revisionId = useMemo(() => new URLSearchParams(window.location.search).get('revision') ?? '', [])
  const [preview, setPreview] = useState<WizardPreview | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!courseId || !revisionId) return
    let active = true
    void api.wizardPreview(courseId, revisionId).then((result) => {
      if (active) setPreview(result)
    }).catch(() => {
      if (active) setError('Could not load this student preview. Return to the Builder and try again.')
    })
    return () => { active = false }
  }, [api, courseId, revisionId])

  const items = preview?.revision.body.sections.flatMap((section) => section.items) ?? []
  const answeredCount = preview?.messages.filter((message) => message.role === 'student').length ?? 0
  const next = items[answeredCount]
  const voice = useChatVoiceInput({ value, onValueChange: setValue,
    disabled: busy || !next || preview?.revision.preview_decision === 'completed', contextKey: preview?.preview_id })

  async function answer(event: FormEvent) {
    event.preventDefault()
    if (!preview || !next || !value.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await api.wizardPreviewAnswer(courseId, preview.preview_id, next.id, value.trim())
      setPreview(await api.wizardPreview(courseId, revisionId))
      setValue('')
    } catch {
      setError('Could not save your practice answer. Check the conversation and try again.')
    } finally { setBusy(false) }
  }

  async function complete() {
    if (!preview || answeredCount !== items.length || busy) return
    setBusy(true)
    setError('')
    try {
      const revision = await api.decideWizardPreview(courseId, revisionId, 'completed', crypto.randomUUID())
      setPreview({ ...preview, revision })
      window.opener?.postMessage({ type: 'leai:wizard-preview-completed', revisionId }, window.location.origin)
    } catch {
      setError('Could not mark this preview complete. Please try again.')
    } finally { setBusy(false) }
  }

  return <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6">
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <a className="text-2xl font-extrabold tracking-tight text-primary" href={toAppHref(environment, 'PromptDesigner.html')}>LEAI</a>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">Student preview · practice mode</span>
      </header>
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-sm font-bold tracking-wider text-primary uppercase">Practice preview</p>
        <h1 className="mt-1 text-2xl font-semibold">{preview?.revision.body.title ?? 'Student preview'}</h1>
        <p className="mt-2 text-base text-muted-foreground">Try the exact feedback conversation students will see. Practice answers stay separate from course feedback and analysis.</p>
      </section>
      {!courseId || !revisionId ? <p role="alert">This preview link is incomplete. Open it from the Feedback Builder.</p>
        : error && !preview ? <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{error}</p>
          : !preview ? <p role="status">Opening student preview…</p>
            : <section aria-label="Student preview conversation" className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <ChatTranscript>{preview.messages.map((message) => <ChatMessage author={message.role === 'student' ? 'You' : 'LEAI'}
                key={message.id} role={message.role === 'student' ? 'user' : 'assistant'} timestamp={message.created_at}>
                <p className={message.role === 'student' ? 'rounded-xl bg-muted px-3 py-2' : 'py-2'}>{message.content}</p>
              </ChatMessage>)}</ChatTranscript>
              {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
              {preview.revision.preview_decision === 'completed'
                ? <p role="status" className="mt-5 rounded-lg bg-success/10 p-4 font-medium text-success">Preview complete. Return to the Builder to publish this version.</p>
                : next ? <form className="mt-4" onSubmit={(event) => { void answer(event) }}>
                  <ChatComposer busy={busy} disabled={busy} inputLabel="Preview answer" onValueChange={setValue}
                    placeholder="Reply as a student to try this question…" sendDisabled={!value.trim()} value={value} voiceInput={voice.voiceInput} />
                  {voice.error && <p className="mt-2 text-sm text-destructive" role="alert">{voice.error}</p>}
                </form> : <div className="mt-5 space-y-3 border-t border-border pt-4">
                  <p>All {items.length} questions were answered in this isolated preview.</p>
                  <Button disabled={busy} onClick={() => { void complete() }} type="button">Complete preview</Button>
                </div>}
            </section>}
      <a className="inline-flex text-sm font-medium text-primary hover:underline" href={toAppHref(environment, 'PromptDesigner.html')}>← Back to Feedback Builder</a>
    </div>
  </main>
}
