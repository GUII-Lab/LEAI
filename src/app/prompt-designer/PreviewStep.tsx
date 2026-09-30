import type { ReactNode } from 'react'
import { WizardStepHeading } from './WizardStepHeading'
import type { WizardRevision } from '@/api/contracts/wizard'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { InfoPopover } from '@/components/product/InfoPopover'

function StudentOutputSetting({ label, help, checked, onChange, disabled }: {
  disabled: boolean
  label: string
  help: ReactNode
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return <div className="flex items-start justify-between gap-3 border-t border-border py-[15px]">
    <span className="flex min-w-0 items-center gap-2 text-[14px] font-bold">{label}
      <InfoPopover label={`About ${label}`} variant="builder">{help}</InfoPopover>
    </span>
    <Switch className="legacy-builder-output-switch mt-0.5 shrink-0" aria-disabled={disabled} aria-label={label} checked={checked} onCheckedChange={(value) => { if (!disabled) onChange(value) }} />
  </div>
}

export function PreviewStep({ teamSetupRequired, onSetupTeams, revision, previewOpened, onLaunch, busy, certificateEnabled, downloadEnabled, onCertificateChange, onDownloadChange }: {
  teamSetupRequired: boolean
  onSetupTeams: () => void
  revision: WizardRevision
  previewOpened: boolean
  onLaunch: () => void
  busy: boolean
  certificateEnabled: boolean
  downloadEnabled: boolean
  onCertificateChange: (value: boolean) => void
  onDownloadChange: (value: boolean) => void
}) {
  return <div className="mx-auto max-w-[1180px] space-y-5">
    <WizardStepHeading eyebrow="Student experience" title="Preview this exact version">
      <p className="flex items-center gap-2">Optional. Try the student experience before publishing.
        <InfoPopover label="About preview mode" variant="builder">This opens the real student flow. Practice responses stay separate from course feedback and analysis.</InfoPopover>
      </p>
    </WizardStepHeading>
    <div className="grid gap-[18px] min-[1101px]:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
      <section className="min-h-[200px] rounded-[14px] bg-[linear-gradient(135deg,var(--builder-preview-start),var(--builder-preview-end))] p-[18px] text-white md:p-[26px]">
        {teamSetupRequired && <Button className="mr-3 border-[#b9c8cc] bg-white text-foreground hover:bg-muted" disabled={busy} onClick={onSetupTeams} type="button" variant="outline">Set up teams</Button>}
        <Button className="mt-5 border-[#b9c8cc] bg-white text-foreground hover:bg-muted" disabled={busy || teamSetupRequired} onClick={onLaunch} type="button" variant="outline">Open student preview ↗</Button>
        {previewOpened && <p className="mt-2 text-sm text-teal-50">Opens in a new tab. Return here when finished.</p>}
        <p className="mt-5 text-xs text-teal-50">{revision.preview_decision ? `Preview ${revision.preview_decision}.` : previewOpened ? 'In progress' : 'Not previewed'}</p>
      </section>
      <aside aria-label="Student outputs" className="min-w-0 rounded-xl border border-border bg-card p-[18px] md:p-[21px]">
        <h4 className="text-[19px] font-semibold">Student outputs</h4>
        <div className="mt-3">
          <StudentOutputSetting disabled={busy} label="Completion certificate" checked={certificateEnabled} onChange={onCertificateChange}
            help="Students can download proof that they completed the conversation. It contains no response text or teammate data." />
          <StudentOutputSetting disabled={busy} label="Completed response form" checked={downloadEnabled} onChange={onDownloadChange}
            help="Students can download only their own completed answers. Files saved to a device are outside LEAI’s control." />
        </div>
        <p className="rounded-lg bg-secondary p-[11px] text-xs text-secondary-foreground">Saved to this draft. Reopen preview to apply changes.</p>
      </aside>
    </div>
  </div>
}
