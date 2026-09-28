const steps = ['Start', 'Audience and format', 'Design', 'Preview', 'Publish'] as const

export type WizardStep = 0 | 1 | 2 | 3 | 4

export function WorkflowStepper({ current }: { current: WizardStep }) {
  return <ol aria-label="Feedback Builder steps" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
    {steps.map((label, index) => <li aria-current={index === current ? 'step' : undefined}
      className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-base ${index === current
        ? 'border-primary bg-primary/10 font-semibold text-foreground'
        : index < current ? 'border-border bg-muted/50 text-foreground' : 'border-border text-muted-foreground'}`}
      key={label}>
      <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index === current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
        {index + 1}
      </span>
      <span className="min-w-0 text-[clamp(0.7rem,2.2vw,1rem)] leading-tight sm:text-base">{label}</span>
    </li>)}
  </ol>
}
