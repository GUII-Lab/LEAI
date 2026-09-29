import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { WorkflowStepper, type WizardStep } from './WorkflowStepper'

export function BuilderFrame({ step, title, onClose, footer, children }: {
  step: WizardStep
  title: string
  onClose: () => void
  footer: ReactNode
  children: ReactNode
}) {
  return <Dialog open onOpenChange={() => {}}>
    <DialogContent
      aria-describedby="builder-description"
      className="legacy-builder left-1/2 top-1/2 flex h-dvh w-screen max-w-none -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-none bg-card p-0 shadow-2xl sm:h-[min(900px,calc(100dvh-44px))] sm:w-[min(1240px,calc(100vw-44px))] sm:max-w-none sm:rounded-[18px]"
      onEscapeKeyDown={(event) => event.preventDefault()}
      onPointerDownOutside={(event) => event.preventDefault()}
      showCloseButton={false}>
      <header className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-8 sm:pt-6 sm:pb-0">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <span className="text-sm font-extrabold tracking-widest text-primary">Feedback builder</span>
            <DialogTitle className="mt-1 text-3xl font-semibold tracking-tight">{title}</DialogTitle>
            <DialogDescription id="builder-description" className="text-sm">Create a feedback experience for this course.</DialogDescription>
          </div>
          <Button aria-label="Close builder" className="border border-border bg-muted" onClick={onClose} size="icon" type="button" variant="ghost"><X className="size-5" /></Button>
        </div>
        <WorkflowStepper current={step} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--builder-surface)] px-4 py-5 sm:px-8 sm:py-8" data-testid="builder-content">
        {children}
      </div>
      <footer className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-8">
        {footer}
      </footer>
    </DialogContent>
  </Dialog>
}
