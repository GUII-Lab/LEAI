const steps = ['Audience', 'Format', 'Build', 'Preview', 'Publish'] as const

export type WizardStep = 0 | 1 | 2 | 3 | 4

export function WorkflowStepper({ current }: { current: WizardStep }) {
  return <ol aria-label="Feedback Builder steps" className="grid grid-cols-5 gap-0 border-t border-border">
    {steps.map((label, index) => <li aria-current={index === current ? 'step' : undefined}
      className={`flex min-h-14 min-w-0 items-center justify-center gap-2 border-b-[3px] px-1 py-3 text-base sm:px-2 ${index === current
        ? 'border-primary font-semibold text-primary'
        : index < current ? 'border-transparent text-success' : 'border-transparent text-muted-foreground'}`}
      key={label}>
      <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${index === current ? 'border-primary text-primary' : index < current ? 'border-success bg-success text-success-foreground' : 'border-input text-muted-foreground'}`}>
        {index < current ? '✓' : index + 1}
      </span>
      <span className={`min-w-0 text-[clamp(0.7rem,2.2vw,1rem)] leading-tight sm:text-base ${index === current ? '' : 'max-sm:sr-only'}`}>{label}</span>
    </li>)}
  </ol>
}
