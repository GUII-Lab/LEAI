import { CircleHelpIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PublicEnvironment } from '@/config/environment'
import { toAppHref } from '@/config/environment'

export function PageNotFound({ environment }: { environment: PublicEnvironment }) {
  return (
    <section className="mx-auto flex min-h-[min(70svh,44rem)] max-w-2xl flex-col items-center justify-center gap-5 text-center">
      <CircleHelpIcon aria-hidden="true" className="size-16 text-muted-foreground" strokeWidth={1.25} />
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">Page Not Found</h1>
        <p className="text-base text-muted-foreground">We couldn’t find the page or course you’re looking for.</p>
      </div>
      <Button asChild><a href={toAppHref(environment, 'InstructorHome.html')}>Return to your courses</a></Button>
    </section>
  )
}
