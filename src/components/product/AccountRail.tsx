import { CircleHelpIcon, CircleUserRoundIcon, LibraryBigIcon, LogOutIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NavigationItem = {
  id: string
  label: string
  href: string
}

const accountIcons = {
  account: CircleUserRoundIcon,
  'all-courses': LibraryBigIcon,
}

export function AccountRail({
  items,
  mobile = false,
}: {
  items: NavigationItem[]
  mobile?: boolean
}) {
  return (
    <nav aria-label="Account navigation" className={cn('flex flex-col gap-1', mobile ? 'p-3' : 'p-2')}>
      <p className={cn(
        'px-2 text-xs font-semibold text-muted-foreground',
        mobile && 'text-[16pt] text-sidebar-foreground/70',
        !mobile && 'sr-only',
      )}>
        Account
      </p>
      {items.map((item) => {
        const Icon = accountIcons[item.id as keyof typeof accountIcons] ?? CircleHelpIcon
        return (
          <a
            aria-label={item.label}
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent',
              mobile && 'text-[16pt]',
              !mobile && 'min-h-[3.5rem] flex-col justify-center gap-1 px-1 py-1 text-[10px] leading-3',
            )}
            href={item.href}
            key={item.id}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <span className={cn(!mobile && 'text-center')}>{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}

export function AccountSignOut({
  mobile = false,
  onSignOut,
  signingOut = false,
}: {
  mobile?: boolean
  onSignOut: () => void
  signingOut?: boolean
}) {
  return (
    <button
      aria-label="Sign out"
      className={cn(
        'flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors disabled:opacity-50',
        mobile
          ? 'text-[16pt] text-sidebar-foreground hover:bg-sidebar-accent focus-visible:bg-sidebar-accent'
          : 'text-sidebar-foreground hover:bg-sidebar-accent focus-visible:bg-sidebar-accent',
        !mobile && 'min-h-[3.5rem] flex-col justify-center gap-1 px-1 py-1 text-[10px] leading-3',
      )}
      disabled={signingOut}
      onClick={onSignOut}
      type="button"
    >
      <LogOutIcon aria-hidden="true" className="size-5 shrink-0" />
      <span className={cn(!mobile && 'text-center')}>{signingOut ? 'Signing out…' : 'Sign out'}</span>
    </button>
  )
}
