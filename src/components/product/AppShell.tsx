import type { ReactNode } from 'react'
import { MenuIcon } from 'lucide-react'
import type { EnvironmentManifest } from '@/config/environment'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AccountRail, AccountSignOut, type NavigationItem } from './AccountRail'
import { CourseNavigation } from './CourseNavigation'
import { EnvironmentBar } from './EnvironmentBar'
import { LegacyCourseRail } from './LegacyCourseRail'

export type AppShellProps = {
  accountItems: NavigationItem[]
  activeItem: string
  children: ReactNode
  courseItems: NavigationItem[]
  courseName?: string
  showCourseNavigation?: boolean
  environment: EnvironmentManifest
  onSignOut?: () => void
  signingOut?: boolean
  signOutError?: string
}

export function AppShell({
  accountItems,
  activeItem,
  children,
  courseItems,
  courseName,
  showCourseNavigation: showCourseNavigationOverride,
  environment,
  onSignOut,
  signingOut,
  signOutError,
}: AppShellProps) {
  const activeCourseItem = courseItems.find((item) => item.id === activeItem)
  const showCourseNavigation = showCourseNavigationOverride
    ?? (activeItem !== 'all-courses' && activeItem !== 'account' && activeItem !== 'not-found')
  const legacyWorkspace = ['prompt-designer', 'feedback-analyzer', 'feedback-chat'].includes(activeItem)

  return (
    <div className={`min-h-screen bg-background text-foreground lg:flex lg:h-svh lg:min-h-0 lg:flex-col lg:overflow-hidden ${legacyWorkspace ? 'legacy-instructor-ui' : ''} ${activeItem === 'feedback-analyzer' ? 'legacy-analyzer' : ''} ${activeItem === 'prompt-designer' ? 'legacy-prompt-designer' : ''}`}>
      <EnvironmentBar environment={environment} />
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label="Open navigation" size="icon" variant="ghost">
              <MenuIcon aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-80 gap-0 overflow-y-auto border-sidebar-border bg-sidebar p-0 text-sidebar-foreground" closeButtonClassName="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" side="left">
            {legacyWorkspace ? <><SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle><SheetDescription>Instructor navigation</SheetDescription></SheetHeader><LegacyCourseRail accountItems={accountItems} activeItem={activeItem} courseItems={courseItems} courseName={courseName} mobile onSignOut={onSignOut} signingOut={signingOut} /></> : <>
            <SheetHeader className="border-b border-sidebar-border bg-sidebar">
              <SheetTitle className="text-[16pt] text-sidebar-foreground">Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Account and active course navigation
              </SheetDescription>
            </SheetHeader>
            <div className="border-b border-sidebar-border bg-sidebar">
              <AccountRail items={accountItems} mobile />
            </div>
            {showCourseNavigation && (
              <CourseNavigation activeItem={activeItem} courseName={courseName} items={courseItems} mobile />
            )}
            {onSignOut && (
              <SheetFooter className="mt-auto border-t border-sidebar-border bg-sidebar p-3">
                <AccountSignOut mobile onSignOut={onSignOut} signingOut={signingOut} />
              </SheetFooter>
            )}
            </>}
          </SheetContent>
        </Sheet>
        {legacyWorkspace ? <span className="text-[0.76rem] font-extrabold uppercase tracking-[0.14em]"><span className="text-sidebar-brand">LEAI</span> Instructor</span> : activeCourseItem && (
          <a
            aria-current="page"
            className="min-w-0 truncate text-base font-semibold text-foreground"
            href={activeCourseItem.href}
          >
            {activeCourseItem.label}
          </a>
        )}
      </div>
      <div className={legacyWorkspace
        ? 'lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[13.75rem_minmax(0,1fr)]'
        : showCourseNavigation
        ? 'lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[7rem_15rem_minmax(0,1fr)]'
        : 'lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[7rem_minmax(0,1fr)]'}>
        {legacyWorkspace ? <aside className="hidden min-h-0 bg-sidebar lg:block">
          <LegacyCourseRail accountItems={accountItems} activeItem={activeItem} courseItems={courseItems} courseName={courseName} onSignOut={onSignOut} signingOut={signingOut} />
        </aside> : <aside className="hidden min-h-0 bg-sidebar lg:flex lg:flex-col">
          <AccountRail items={accountItems} />
          {onSignOut && (
            <div className="mt-auto border-t border-border p-2">
              <AccountSignOut onSignOut={onSignOut} signingOut={signingOut} />
            </div>
          )}
        </aside>}
        {showCourseNavigation && !legacyWorkspace && <aside className="hidden min-h-0 overflow-y-auto border-r border-border bg-card lg:block">
          <CourseNavigation activeItem={activeItem} courseName={courseName} items={courseItems} />
        </aside>}
        <main className={legacyWorkspace ? `min-w-0 px-4 py-6 sm:px-7 lg:min-h-0 lg:overflow-y-auto ${activeItem === 'feedback-analyzer' ? 'legacy-analyzer-main' : ''} ${activeItem === 'prompt-designer' ? 'legacy-prompt-main' : ''}` : 'min-w-0 px-5 py-8 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:px-10'}>
          {signOutError && <p className="mb-4 text-sm text-destructive" role="alert">{signOutError}</p>}
          {children}
        </main>
      </div>
    </div>
  )
}
