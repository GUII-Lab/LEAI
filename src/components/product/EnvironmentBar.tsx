import type { EnvironmentManifest } from '@/config/environment'

export function EnvironmentBar({ environment }: { environment: EnvironmentManifest }) {
  if (environment.name !== 'qa') return null

  return (
    <div className="border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-center text-xs font-medium text-foreground">
      QA environment
    </div>
  )
}
