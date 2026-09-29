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
      <Button aria-label={ariaLabel} className="legacy-evidence-citation" size="xs" type="button" variant="outline">{label}</Button>
    </PopoverTrigger>
    <PopoverContent align="start" aria-labelledby={titleId} className="legacy-evidence-popover break-words">
      <div><h3 className="text-[0.78rem] font-bold tracking-wide" id={titleId}>{sourceLabel ?? `Source ${label}`}</h3>{meta?.length ? <dl className="mt-1 flex flex-wrap gap-x-3 text-[0.7rem] text-muted-foreground">{meta.map((item) => <div key={item.label}><dt className="sr-only">{item.label}</dt><dd>{item.value}</dd></div>)}</dl> : null}</div>
      <blockquote className="legacy-evidence-quote">“{excerpt}”</blockquote>
      {href ? <a className="text-primary underline" href={href} onClick={onOpenSource ? (event) => { event.preventDefault(); onOpenSource() } : undefined}>Open response {label}</a>
        : onOpenSource && <Button onClick={onOpenSource} type="button" variant="link">Open full response</Button>}
    </PopoverContent>
  </Popover>
}
