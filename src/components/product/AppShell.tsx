import type { ReactNode } from 'react'
import { MenuIcon } from 'lucide-react'
import type { EnvironmentManifest } from '@/config/environment'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AccountRail, type NavigationItem } from './AccountRail'
import { CourseNavigation } from './CourseNavigation'
import { EnvironmentBar } from './EnvironmentBar'

export type AppShellProps = {
  accountItems: NavigationItem[]
  activeItem: string
  children: ReactNode
  courseItems: NavigationItem[]
  courseName?: string
  environment: EnvironmentManifest
}

export function AppShell({
  accountItems,
  activeItem,
  children,
  courseItems,
  courseName,
  environment,
}: AppShellProps) {
  const activeCourseItem = courseItems.find((item) => item.id === activeItem)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <EnvironmentBar environment={environment} />
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label="Open navigation" size="icon" variant="ghost">
              <MenuIcon aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-80 p-0" side="left">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Account and active course navigation
              </SheetDescription>
            </SheetHeader>
            <div className="border-y border-border bg-sidebar">
              <AccountRail items={accountItems} mobile />
            </div>
            <CourseNavigation activeItem={activeItem} courseName={courseName} items={courseItems} />
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
      <div className="lg:grid lg:min-h-[calc(100vh-2rem)] lg:grid-cols-[4.5rem_15rem_minmax(0,1fr)]">
        <aside className="hidden bg-sidebar lg:block">
          <AccountRail items={accountItems} />
        </aside>
        <aside className="hidden border-r border-border bg-card lg:block">
          <CourseNavigation activeItem={activeItem} courseName={courseName} items={courseItems} />
        </aside>
        <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
