import type { ReactNode } from 'react'
import { WizardStepHeading } from './WizardStepHeading'
import type { WizardRevision } from '@/api/contracts/wizard'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { InfoPopover } from '@/components/product/InfoPopover'

function StudentOutputSetting({ label, help, checked, onChange }: {
  label: string
  help: ReactNode
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return <div className="flex items-start justify-between gap-3 border-t border-border py-[15px] first:border-t-0">
    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">{label}
      <InfoPopover label={`About ${label}`} variant="builder">{help}</InfoPopover>
    </span>
    <Switch className="legacy-builder-output-switch mt-0.5 shrink-0" aria-label={label} checked={checked} onCheckedChange={onChange} />
  </div>
}

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
    <WizardStepHeading eyebrow="Student experience" title="Preview this exact version">
      <p className="flex items-center gap-2">Optional. Try the student experience before publishing.
        <InfoPopover label="About preview mode" variant="builder">This opens the real student flow. Practice responses stay separate from course feedback and analysis.</InfoPopover>
      </p>
    </WizardStepHeading>
    <p className="flex w-fit max-w-full items-center gap-2 text-xs text-[#754713]">
      <strong>Practice only. Do not enter real student information.</strong>
      <InfoPopover label="How preview data is isolated" variant="builder">Practice responses stay separate from course feedback and analysis.</InfoPopover>
    </p>
    <div className="grid gap-[18px] min-[1101px]:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
      <section className="min-h-[360px] rounded-[14px] bg-[linear-gradient(135deg,var(--builder-preview-start),var(--builder-preview-end))] p-[18px] text-white md:p-[26px]">
        <p className="text-sm font-bold tracking-widest text-[#bfeae6] uppercase">Practice preview</p>
        <h4 className="mt-9 mb-3 text-[30px] leading-tight font-bold break-words">{revision.body.title}</h4>
        <p className="text-base text-teal-50">Opens in a new tab.</p>
        <Button className="mt-5 bg-white text-primary hover:bg-teal-50" disabled={busy} onClick={onLaunch} type="button">Open student preview ↗</Button>
        {previewOpened && <p className="mt-2 text-sm text-teal-50">Your preview tab is open. Return here when finished.</p>}
        <p className="mt-5 text-xs text-teal-50">{revision.preview_decision ? `Preview ${revision.preview_decision}.` : 'Not previewed'}</p>
      </section>
      <aside aria-label="Student outputs" className="min-w-0 rounded-xl border border-border bg-card p-[18px] md:p-[21px]">
        <p className="text-sm font-bold tracking-widest text-primary uppercase">Student outputs</p>
        <h4 className="mt-1.5 text-[19px] font-semibold">What students receive</h4>
        <div className="mt-3">
          <StudentOutputSetting label="Completion certificate" checked={certificateEnabled} onChange={onCertificateChange}
            help="Students can download proof that they completed the conversation. It contains no response text or teammate data." />
          <StudentOutputSetting label="Completed response form" checked={downloadEnabled} onChange={onDownloadChange}
            help="Students can download only their own completed answers. Files saved to a device are outside LEAI’s control." />
        </div>
        <p className="rounded-lg bg-secondary p-[11px] text-xs text-secondary-foreground">These settings are saved when you publish.</p>
      </aside>
    </div>
    {revision.preview_decision
      ? <p role="status" className="rounded-lg border border-border bg-muted/50 p-4">Preview {revision.preview_decision} for this exact revision.</p>
      : <div className="border-t border-border pt-4">
        <Button disabled={busy} onClick={() => onDecision('skipped')} type="button" variant="outline">Skip preview for this revision</Button>
      </div>}
  </div>
}
