const steps = ['Audience', 'Format', 'Build', 'Preview', 'Publish'] as const

export type WizardStep = 0 | 1 | 2 | 3 | 4

export function WorkflowStepper({ current }: { current: WizardStep }) {
  return <ol aria-label="Feedback Builder steps" className={`mx-auto grid w-full grid-cols-3 gap-0 min-[601px]:grid-cols-5 ${current < 2 ? 'max-w-[900px]' : 'max-w-[1180px]'}`}>
    {steps.map((label, index) => <li aria-current={index === current ? 'step' : undefined}
      className={`flex min-w-0 items-center justify-center gap-1 border-b-[3px] px-1 py-[14px] text-[14px] leading-[1.2] font-[750] min-[601px]:px-2 ${index === current
        ? 'border-[#146b93] text-[#146b93]'
        : index < current ? 'border-transparent text-secondary-foreground' : 'border-transparent text-[#8a989c]'}`}
      key={label}>
      <span aria-hidden="true">{index + 1}</span>
      <span>{label}</span>
    </li>)}
  </ol>
}
