import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** One citation presentation for instructor Chat and Analyzer. */
export function EvidenceCitation({ label, ariaLabel, sourceLabel, excerpt, meta, href, onOpenSource }: {
  label: string
  ariaLabel: string
  sourceLabel?: string
  excerpt: string
  meta?: readonly { label: string; value: string }[]
  href?: string
  onOpenSource?: () => void
}) {
  const titleId = useId()
  return <Popover>
    <PopoverTrigger asChild>
      <Button aria-label={ariaLabel} className="h-6 min-w-6 rounded border border-primary/30 bg-primary/5 px-1.5 text-sm font-semibold text-primary hover:bg-primary/10" size="xs" type="button" variant="outline">[{label}]</Button>
    </PopoverTrigger>
    <PopoverContent align="start" aria-labelledby={titleId} className="w-[min(25rem,calc(100vw-2rem))] space-y-3 break-words border-border p-4 text-base shadow-lg">
      <div><h3 className="font-bold" id={titleId}>{sourceLabel ?? `Source ${label}`}</h3>{meta?.length ? <dl className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">{meta.map((item) => <div key={item.label}><dt className="sr-only">{item.label}</dt><dd>{item.value}</dd></div>)}</dl> : null}</div>
      <blockquote className="border-l-[3px] border-primary py-0.5 pl-3 leading-relaxed">{excerpt}</blockquote>
      {href ? <a className="text-primary underline" href={href} onClick={onOpenSource ? (event) => { event.preventDefault(); onOpenSource() } : undefined}>Open response {label}</a>
        : onOpenSource && <Button onClick={onOpenSource} type="button" variant="link">Open full response</Button>}
    </PopoverContent>
  </Popover>
}
