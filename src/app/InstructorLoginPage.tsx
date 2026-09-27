import { useEffect, useState, type FormEvent } from 'react'
import { AuthenticationRequiredError, createInstructorApi, InstructorApiError } from '@/api/instructor-v1'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getEnvironment, qualifyBrowserKey, type PublicEnvironment } from '@/config/environment'
import { EnvironmentGate, useEnvironmentWriteAccess } from './EnvironmentGate'
import { safeInstructorDestination } from '@/auth/navigation'

function LoginForm({ environment }: { environment: PublicEnvironment }) {
  const verified = useEnvironmentWriteAccess()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const tokenKey = qualifyBrowserKey(environment.name, 'instructor-token')
  const next = safeInstructorDestination(environment, new URLSearchParams(window.location.search).get('next'))

  useEffect(() => {
    sessionStorage.removeItem(tokenKey)
    if (!verified) return
    let active = true
    void createInstructorApi(environment, () => true).me().then(() => {
      if (!active) return
      window.location.replace(next)
    }).catch((cause: unknown) => {
      if (active && cause instanceof AuthenticationRequiredError) sessionStorage.removeItem(tokenKey)
    })
    return () => { active = false }
  }, [environment, next, tokenKey, verified])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verified) return
    setSubmitting(true)
    setError('')
    try {
      await createInstructorApi(environment, () => true).login(email, password)
      sessionStorage.removeItem(qualifyBrowserKey(environment.name, 'selected-course'))
      setPassword('')
      window.location.replace(next)
    } catch (cause) {
      setError(cause instanceof InstructorApiError && cause.status === 429
        ? 'Too many attempts. Please wait before trying again.'
        : 'Sign-in failed. Check your email and password.')
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md space-y-5">
        <p className="text-center text-sm font-semibold tracking-wide text-muted-foreground">LEAI · Instructor workspace</p>
        <Card className="w-full">
          <CardHeader>
            <CardTitle><h1 className="text-2xl">Instructor sign in</h1></CardTitle>
            <CardDescription>Use your LEAI instructor account to open your courses.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void signIn(event)}>
              <label className="block space-y-1.5 text-sm font-medium">Email
                <Input autoComplete="username" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">Password
                <Input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
              </label>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button className="w-full" disabled={!verified || submitting} type="submit">
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
              {!verified && <p className="text-xs text-muted-foreground" role="status">Checking the LEAI service before sign-in…</p>}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export function InstructorLoginPage() {
  const environment = getEnvironment()
  return <EnvironmentGate environment={environment}><LoginForm environment={environment} /></EnvironmentGate>
}
