import type { ReactNode } from 'react'

export function PageHeader({
  actions,
  description,
  title,
}: {
  actions?: ReactNode
  description?: string
  title: string
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
