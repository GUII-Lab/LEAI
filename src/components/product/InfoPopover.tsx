import type { ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Compact help used beside a decision or metric, with click and keyboard access. */
export function InfoPopover({ label, children, variant = 'compact' }: { label: string; children: ReactNode; variant?: 'compact' | 'builder' }) {
  return <Popover>
    <PopoverTrigger asChild>
      <button aria-label={label} className={`inline-flex shrink-0 items-center justify-center rounded-full border border-current font-bold leading-none text-muted-foreground hover:text-primary focus-visible:text-primary ${variant === 'builder' ? 'size-[21px] bg-card text-xs' : 'size-3.5 text-[9px] italic'}`} type="button">{variant === 'builder' ? '?' : 'i'}</button>
    </PopoverTrigger>
    <PopoverContent align="end" className="max-w-[min(22rem,calc(100vw-2rem))] whitespace-pre-line text-base leading-relaxed">{children}</PopoverContent>
  </Popover>
}
