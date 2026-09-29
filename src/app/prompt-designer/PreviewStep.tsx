import type { WizardRevision } from '@/api/contracts/wizard'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { InfoPopover } from '@/components/product/InfoPopover'

export function PreviewStep({ revision, previewOpened, onLaunch, onDecision, busy, certificateEnabled, downloadEnabled, onCertificateChange, onDownloadChange }: {
  revision: WizardRevision
  previewOpened: boolean
  onLaunch: () => void
  onDecision: (value: 'completed' | 'skipped') => void
  busy: boolean
  certificateEnabled: boolean
  downloadEnabled: boolean
  onCertificateChange: (value: boolean) => void
  onDownloadChange: (value: boolean) => void
}) {
  return <div className="mx-auto max-w-5xl space-y-5">
    <div>
      <p className="text-sm font-extrabold tracking-widest text-primary uppercase">Student experience</p>
      <h3 className="mt-1 text-3xl font-semibold">Preview the student experience</h3>
      <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">Optional. Try the student flow before publishing. <InfoPopover label="About preview mode" variant="builder">Practice responses stay separate from course feedback and analysis.</InfoPopover></p>
    </div>
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(17.5rem,0.8fr)]">
      <section className="flex min-h-[16.25rem] flex-col items-start justify-center rounded-xl bg-[linear-gradient(135deg,var(--builder-preview-start),var(--builder-preview-end))] p-7 text-white">
        <p className="text-sm font-bold tracking-widest text-teal-100 uppercase">Practice preview</p>
        <h4 className="mt-3 text-3xl font-bold">{revision.body.title}</h4>
        <p className="mt-2 text-base text-teal-50">Opens in a new tab so the Builder stays available.</p>
        <Button className="mt-5 bg-white text-primary hover:bg-teal-50" disabled={busy} onClick={onLaunch} type="button">Open student preview ↗</Button>
        {previewOpened && <p className="mt-2 text-sm text-teal-50">Your preview tab is open. Return here when finished.</p>}
        <p className="mt-5 text-sm text-teal-50">{revision.preview_decision ? `Preview ${revision.preview_decision}.` : 'Not completed. You may preview or skip.'}</p>
      </section>
      <aside aria-label="Student outputs" className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-bold tracking-widest text-primary uppercase">Student outputs</p>
        <h4 className="mt-1 text-xl font-semibold">What students receive</h4>
        <div className="mt-3 divide-y divide-border">
          <div className="flex items-center justify-between gap-4 py-4"><span className="space-y-1"><span className="flex items-center gap-2 font-semibold">Completion certificate <InfoPopover label="About Completion certificate" variant="builder">Students can download proof that they completed the conversation. It contains no response text or teammate data.</InfoPopover></span><span className="block text-sm text-muted-foreground">Downloadable proof of completion.</span></span><Switch aria-label="Completion certificate" checked={certificateEnabled} onCheckedChange={onCertificateChange} /></div>
          <div className="flex items-center justify-between gap-4 py-4"><span className="space-y-1"><span className="flex items-center gap-2 font-semibold">Completed response form <InfoPopover label="About Completed response form" variant="builder">Students can download only their own completed answers. Files saved to a device are outside LEAI’s control.</InfoPopover></span><span className="block text-sm text-muted-foreground">A copy of their own answers.</span></span><Switch aria-label="Completed response form" checked={downloadEnabled} onCheckedChange={onDownloadChange} /></div>
        </div>
        <p className="rounded-md bg-secondary p-3 text-sm text-secondary-foreground">These settings are saved when you publish.</p>
      </aside>
    </div>
    {revision.preview_decision
      ? <p role="status" className="rounded-lg border border-border bg-muted/50 p-4">Preview {revision.preview_decision} for this exact revision.</p>
      : <div className="border-t border-border pt-4">
        <Button disabled={busy} onClick={() => onDecision('skipped')} type="button" variant="outline">Skip preview for this revision</Button>
      </div>}
  </div>
}
