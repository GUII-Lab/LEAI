import { ChartNoAxesCombined, CircleUserRound, FilePenLine, LibraryBig, LogOut, MessagesSquare, SlidersHorizontal } from 'lucide-react'
import type { NavigationItem } from './AccountRail'

const icons = {
  account: CircleUserRound,
  'all-courses': LibraryBig,
  'prompt-designer': FilePenLine,
  'feedback-analyzer': ChartNoAxesCombined,
  'feedback-chat': MessagesSquare,
  settings: SlidersHorizontal,
}

export function LegacyCourseRail({ accountItems, activeItem, courseItems, courseName, onSignOut, signingOut, mobile = false }: {
  accountItems: NavigationItem[]
  activeItem: string
  courseItems: NavigationItem[]
  courseName?: string
  onSignOut?: () => void
  signingOut?: boolean
  mobile?: boolean
}) {
  const allCourses = accountItems.find((item) => item.id === 'all-courses')
  const account = accountItems.find((item) => item.id === 'account')
  const items = [...(allCourses ? [allCourses] : []), ...courseItems, ...(account ? [account] : [])]
  return <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
    <div className="border-b border-sidebar-border px-4 py-4">
      <p className="text-base font-extrabold tracking-[0.08em]">LEAI</p>
      <p className="truncate text-sm text-sidebar-foreground/75" title={courseName}>{courseName}</p>
    </div>
    <nav aria-label="Instructor navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
      {items.map((item) => {
        const Icon = icons[item.id as keyof typeof icons] ?? LibraryBig
        return <a aria-current={item.id === activeItem ? 'page' : undefined}
          className={`flex min-h-10 items-center gap-3 rounded-md px-3 font-medium transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent ${mobile ? 'text-[16pt]' : 'text-base'} ${item.id === activeItem ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/80'}`}
          href={item.href} key={item.id}>
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          <span>{item.label}</span>
        </a>
      })}
    </nav>
    {onSignOut && <div className="mt-auto border-t border-sidebar-border p-2">
      <button aria-label="Sign out" className={`flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent disabled:opacity-50 ${mobile ? 'text-[16pt]' : 'text-base'}`}
        disabled={signingOut} onClick={onSignOut} type="button">
        <LogOut aria-hidden="true" className="size-5" />{signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>}
  </div>
}
