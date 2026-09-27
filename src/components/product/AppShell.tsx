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

export type AppShellProps = {
  accountItems: NavigationItem[]
  activeItem: string
  children: ReactNode
  courseItems: NavigationItem[]
  courseName?: string
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
  environment,
  onSignOut,
  signingOut,
  signOutError,
}: AppShellProps) {
  const activeCourseItem = courseItems.find((item) => item.id === activeItem)
  const showCourseNavigation = activeItem !== 'all-courses' && activeItem !== 'account'

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex lg:h-svh lg:min-h-0 lg:flex-col lg:overflow-hidden">
      <EnvironmentBar environment={environment} />
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label="Open navigation" size="icon" variant="ghost">
              <MenuIcon aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-80 gap-0 overflow-y-auto border-sidebar-border bg-sidebar p-0 text-sidebar-foreground" closeButtonClassName="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" side="left">
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
          </SheetContent>
        </Sheet>
        {activeCourseItem && (
          <a
            aria-current="page"
            className="min-w-0 truncate text-sm font-semibold text-foreground"
            href={activeCourseItem.href}
          >
            {activeCourseItem.label}
          </a>
        )}
      </div>
      <div className={showCourseNavigation
        ? 'lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[4.5rem_15rem_minmax(0,1fr)]'
        : 'lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[4.5rem_minmax(0,1fr)]'}>
        <aside className="hidden min-h-0 bg-sidebar lg:flex lg:flex-col">
          <AccountRail items={accountItems} />
          {onSignOut && (
            <div className="mt-auto border-t border-border p-2">
              <AccountSignOut onSignOut={onSignOut} signingOut={signingOut} />
            </div>
          )}
        </aside>
        {showCourseNavigation && <aside className="hidden min-h-0 overflow-y-auto border-r border-border bg-card lg:block">
          <CourseNavigation activeItem={activeItem} courseName={courseName} items={courseItems} />
        </aside>}
        <main className="min-w-0 px-5 py-8 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:px-10">
          {signOutError && <p className="mb-4 text-sm text-destructive" role="alert">{signOutError}</p>}
          {children}
        </main>
      </div>
    </div>
  )
}
