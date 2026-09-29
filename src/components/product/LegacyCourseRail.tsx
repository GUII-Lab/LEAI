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
      <p className="text-[0.76rem] font-extrabold uppercase tracking-[0.14em]"><span className="text-sidebar-brand">LEAI</span> Instructor</p>
      <p className="truncate text-sm text-sidebar-foreground/75" title={courseName}>{courseName}</p>
    </div>
    <nav aria-label="Instructor navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
      {items.map((item) => {
        const Icon = icons[item.id as keyof typeof icons] ?? LibraryBig
        return <a aria-current={item.id === activeItem ? 'page' : undefined}
          className={`flex min-h-[46px] items-center gap-3 rounded-[7px] px-[14px] py-[11px] font-semibold transition-colors hover:bg-sidebar-hover focus-visible:bg-sidebar-hover ${mobile ? 'text-[16pt]' : 'text-[0.9rem]'} ${item.id === activeItem ? 'bg-sidebar-current text-sidebar-current-foreground hover:bg-sidebar-current focus-visible:bg-sidebar-current' : 'text-sidebar-muted'}`}
          href={item.href} key={item.id}>
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          <span>{item.label}</span>
        </a>
      })}
    </nav>
    {onSignOut && <div className="mt-auto border-t border-sidebar-border p-2">
      <button aria-label="Sign out" className={`flex min-h-[46px] w-full items-center gap-3 rounded-[7px] px-[14px] py-[11px] text-left font-semibold text-sidebar-signout hover:bg-sidebar-hover focus-visible:bg-sidebar-hover disabled:opacity-50 ${mobile ? 'text-[16pt]' : 'text-[0.9rem]'}`}
        disabled={signingOut} onClick={onSignOut} type="button">
        <LogOut aria-hidden="true" className="size-5" />{signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>}
  </div>
}
