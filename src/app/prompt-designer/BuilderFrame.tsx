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
      className="inset-0 left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-background p-0 sm:inset-[2vh_2vw] sm:h-[96vh] sm:w-[96vw] sm:max-w-none sm:rounded-xl"
      onEscapeKeyDown={(event) => event.preventDefault()}
      onPointerDownOutside={(event) => event.preventDefault()}
      showCloseButton={false}>
      <header className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
            <DialogDescription id="builder-description" className="text-sm">Create a feedback experience for this course.</DialogDescription>
          </div>
          <Button aria-label="Close builder" onClick={onClose} size="icon" type="button" variant="ghost"><X className="size-5" /></Button>
        </div>
        <WorkflowStepper current={step} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" data-testid="builder-content">
        {children}
      </div>
      <footer className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-4 py-3 sm:px-6">
        {footer}
      </footer>
    </DialogContent>
  </Dialog>
}
