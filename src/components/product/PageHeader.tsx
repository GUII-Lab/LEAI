import type { ReactNode } from 'react'

export function PageHeader({
  actions,
  badge,
  description,
  title,
}: {
  actions?: ReactNode
  badge?: string
  description?: ReactNode
  title: string
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight text-foreground">{title}{badge && <span className="inline-flex items-center gap-2 rounded-full bg-guided/10 px-2.5 py-1 text-[0.68rem] font-bold tracking-widest text-guided uppercase before:size-1.5 before:rounded-full before:bg-current before:content-['']">{badge}</span>}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
