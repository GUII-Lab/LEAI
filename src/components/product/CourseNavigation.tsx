import { FilePenLineIcon } from 'lucide-react'
import type { NavigationItem } from './AccountRail'
import { cn } from '@/lib/utils'

export function CourseNavigation({
  activeItem,
  courseName = 'Active course',
  items,
}: {
  activeItem: string
  courseName?: string
  items: NavigationItem[]
}) {
  return (
    <nav aria-label="Course navigation" className="flex flex-col gap-1 p-3">
      <p className="px-2 text-xs font-semibold text-muted-foreground">{courseName}</p>
      {items.map((item) => {
        const isActive = item.id === activeItem
        return (
          <a
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:bg-muted',
              isActive && 'bg-secondary text-secondary-foreground',
            )}
            href={item.href}
            key={item.id}
          >
            <FilePenLineIcon aria-hidden="true" className="size-4 shrink-0" />
            <span>{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
