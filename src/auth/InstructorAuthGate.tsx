import { useEffect, useState, type ReactNode } from 'react'
import { AuthenticationRequiredError, createInstructorApi } from '@/api/instructor-v1'
import { Button } from '@/components/ui/button'
import { qualifyBrowserKey, type PublicEnvironment } from '@/config/environment'
import { useEnvironmentStatus, useEnvironmentWriteAccess } from '@/app/EnvironmentGate'
import { loginHref, safeInstructorDestination } from './navigation'

export function InstructorAuthGate({ children, environment }: {
  children: ReactNode
  environment: PublicEnvironment
}) {
  const verified = useEnvironmentWriteAccess()
  const environmentStatus = useEnvironmentStatus()
  const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const next = safeInstructorDestination(environment, window.location.pathname)
    const tokenKey = qualifyBrowserKey(environment.name, 'instructor-token')
    sessionStorage.removeItem(tokenKey)
    if (!verified) return

    let active = true
    void createInstructorApi(environment, () => true).me().then(() => {
      if (!active) return
      setStatus('ready')
    }).catch((error: unknown) => {
      if (!active) return
      if (error instanceof AuthenticationRequiredError) {
        sessionStorage.removeItem(tokenKey)
        sessionStorage.removeItem(qualifyBrowserKey(environment.name, 'selected-course'))
        window.location.replace(loginHref(environment, next))
      } else {
        setStatus('error')
      }
    })
    return () => { active = false }
  }, [attempt, environment, verified])

  if (status === 'ready') return children
  if (environmentStatus === 'read-only') {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 text-center">
        <p role="alert">Instructor sign-in is unavailable because the LEAI service identity could not be verified.</p>
      </main>
    )
  }
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      {status === 'error' ? (
        <>
          <p role="alert">Your account could not be verified right now.</p>
          <Button onClick={() => { setStatus('checking'); setAttempt((value) => value + 1) }} variant="outline">Retry</Button>
        </>
      ) : <p role="status">Checking your account…</p>}
    </main>
  )
}
