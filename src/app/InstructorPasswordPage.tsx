import { useState, type FormEvent } from 'react'
import { AuthenticationRequiredError, createInstructorApi, InstructorApiError } from '@/api/instructor-v1'
import { InstructorAuthGate } from '@/auth/InstructorAuthGate'
import { loginHref, safeInstructorDestination } from '@/auth/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getEnvironment, qualifyBrowserKey, type PublicEnvironment } from '@/config/environment'
import { EnvironmentGate } from './EnvironmentGate'

function PasswordForm({ environment }: { environment: PublicEnvironment }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const tokenKey = qualifyBrowserKey(environment.name, 'instructor-token')
  const next = safeInstructorDestination(environment, new URLSearchParams(window.location.search).get('next'))

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword !== confirmation) {
      setError('The new passwords do not match.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createInstructorApi(environment, () => true)
        .changePassword(currentPassword, newPassword)
      sessionStorage.removeItem(tokenKey)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      window.location.replace(next)
    } catch (cause) {
      if (cause instanceof AuthenticationRequiredError) {
        sessionStorage.removeItem(tokenKey)
        window.location.replace(loginHref(environment, next))
        return
      }
      setError(cause instanceof InstructorApiError && cause.code === 'invalid_credentials'
        ? 'The current password is incorrect.'
        : cause instanceof InstructorApiError && cause.code === 'weak_password'
          ? 'Choose a longer, less common password that you have not used here before.'
          : 'Password could not be changed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md space-y-5">
        <p className="text-center text-sm font-semibold tracking-wide text-muted-foreground">LEAI · Instructor workspace</p>
        <Card className="w-full">
          <CardHeader>
            <CardTitle><h1 className="text-2xl">Change your password</h1></CardTitle>
          <CardDescription>Update your instructor account password. Other signed-in sessions will end.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void changePassword(event)}>
              <label className="block space-y-1.5 text-sm font-medium">Current password
                <Input autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">New password
                <Input autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">Confirm new password
                <Input autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
              </label>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button className="w-full" disabled={submitting} type="submit">
                {submitting ? 'Changing password…' : 'Change password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export function InstructorPasswordPage() {
  const environment = getEnvironment()
  return (
    <EnvironmentGate environment={environment}>
      <InstructorAuthGate environment={environment}>
        <PasswordForm environment={environment} />
      </InstructorAuthGate>
    </EnvironmentGate>
  )
}
