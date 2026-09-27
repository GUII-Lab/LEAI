import {
  ChartNoAxesCombinedIcon,
  CircleHelpIcon,
  FilePenLineIcon,
  MessagesSquareIcon,
  PanelsTopLeftIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'
import type { NavigationItem } from './AccountRail'
import { cn } from '@/lib/utils'

const courseIcons = {
  'prompt-designer': FilePenLineIcon,
  'feedback-analyzer': ChartNoAxesCombinedIcon,
  'feedback-chat': MessagesSquareIcon,
  'course-banner': PanelsTopLeftIcon,
  customizations: SlidersHorizontalIcon,
}

export function CourseNavigation({
  activeItem,
  courseName = 'Active course',
  items,
  mobile = false,
}: {
  activeItem: string
  courseName?: string
  items: NavigationItem[]
  mobile?: boolean
}) {
  return (
    <nav aria-label="Course navigation" className={cn('flex flex-col gap-1 p-3', mobile && 'bg-sidebar')}>
      <p className={cn(
        'px-2 text-xs font-semibold text-muted-foreground',
        mobile && 'text-[16pt] text-sidebar-foreground/70',
      )}>{courseName}</p>
      {items.map((item) => {
        const isActive = item.id === activeItem
        const Icon = courseIcons[item.id as keyof typeof courseIcons] ?? CircleHelpIcon
        return (
          <a
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-md px-2 font-medium transition-colors',
              mobile
                ? 'text-[16pt] text-sidebar-foreground hover:bg-sidebar-accent focus-visible:bg-sidebar-accent'
                : 'text-sm text-foreground hover:bg-muted focus-visible:bg-muted',
              isActive && (mobile
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'bg-secondary text-secondary-foreground'),
            )}
            href={item.href}
            key={item.id}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <span>{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
