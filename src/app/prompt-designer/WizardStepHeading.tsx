import type { ReactNode } from 'react'

export function WizardStepHeading({ eyebrow, title, children }: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return <header>
    <p className="text-[11px] font-extrabold tracking-[0.11em] text-secondary-foreground uppercase">{eyebrow}</p>
    <h3 className="legacy-builder-step-heading mt-1 font-semibold tracking-tight">{title}</h3>
    <div className="mt-2 text-base text-muted-foreground">{children}</div>
  </header>
}
