const steps = ['Audience', 'Format', 'Build', 'Preview', 'Publish'] as const

export type WizardStep = 0 | 1 | 2 | 3 | 4

export function WorkflowStepper({ current }: { current: WizardStep }) {
  return <ol aria-label="Feedback Builder steps" className="grid grid-cols-5 gap-0 border-t border-border">
    {steps.map((label, index) => <li aria-current={index === current ? 'step' : undefined}
      className={`flex min-h-14 min-w-0 items-center justify-center gap-0 border-b-[3px] px-0 py-2.5 text-base sm:gap-2 sm:px-2 sm:py-3 ${index === current
        ? 'border-primary font-semibold text-primary'
        : index < current ? 'border-transparent text-success' : 'border-transparent text-muted-foreground'}`}
      key={label}>
      <span aria-hidden="true" className={`flex size-[23px] shrink-0 items-center justify-center rounded-full border text-xs font-semibold sm:size-7 ${index === current ? 'border-primary text-primary' : index < current ? 'border-success bg-success text-success-foreground' : 'border-input text-muted-foreground'}`}>
        {index < current ? '✓' : index + 1}
      </span>
      <span className={`min-w-0 text-[11px] leading-tight sm:text-base ${index === current ? 'max-sm:ml-[5px]' : 'max-sm:sr-only'}`}>{label}</span>
    </li>)}
  </ol>
}
