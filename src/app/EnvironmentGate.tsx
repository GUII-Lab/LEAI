import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchEnvironmentIdentity } from '@/api/environment'
import {
  getEnvironment,
  type EnvironmentManifest,
  type EnvironmentVerification,
  verifyEnvironment,
} from '@/config/environment'

type GateState =
  | { status: 'checking' }
  | { status: 'verified' }
  | { status: 'read-only'; reason: string }

const EnvironmentWriteContext = createContext(false)

export function useEnvironmentWriteAccess() {
  return useContext(EnvironmentWriteContext)
}

export function EnvironmentGate({
  children,
  environment: providedEnvironment,
}: {
  children: ReactNode
  environment?: EnvironmentManifest
}) {
  const environment = useMemo(() => providedEnvironment ?? getEnvironment(), [providedEnvironment])
  const [state, setState] = useState<GateState>({ status: 'checking' })

  useEffect(() => {
    let active = true

    async function verify() {
      try {
        const observed = await fetchEnvironmentIdentity(environment.apiBaseUrl)
        const result: EnvironmentVerification = verifyEnvironment(environment, observed)
        if (!active) return
        setState(result.ok ? { status: 'verified' } : { status: 'read-only', reason: result.reason })
      } catch {
        if (active) {
          setState({
            status: 'read-only',
            reason: 'The backend identity could not be verified.',
          })
        }
      }
    }

    void verify()
    return () => {
      active = false
    }
  }, [environment])

  const isVerified = state.status === 'verified'

  return (
    <EnvironmentWriteContext value={isVerified}>
      <div data-environment={environment.name} data-write-state={state.status}>
        {state.status === 'checking' && (
          <p className="sr-only" role="status">
            Checking {environment.environmentLabel} environment identity.
          </p>
        )}
        {state.status === 'read-only' && (
          <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-foreground" role="alert">
            <strong>Read-only mode.</strong> {state.reason}
          </div>
        )}
        {children}
      </div>
    </EnvironmentWriteContext>
  )
}
