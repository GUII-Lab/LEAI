import { CircleUserRoundIcon, Layers3Icon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NavigationItem = {
  id: string
  label: string
  href: string
}

const accountIcons = {
  account: CircleUserRoundIcon,
  'all-courses': Layers3Icon,
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
      <p className={cn('px-2 text-xs font-semibold text-muted-foreground', !mobile && 'sr-only')}>
        Account
      </p>
      {items.map((item) => {
        const Icon = accountIcons[item.id as keyof typeof accountIcons] ?? CircleUserRoundIcon
        return (
          <a
            aria-label={item.label}
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent',
              !mobile && 'justify-center',
            )}
            href={item.href}
            key={item.id}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <span className={cn(!mobile && 'sr-only')}>{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
