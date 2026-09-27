import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CanonicalInstructorMe } from '@/api/contracts/instructor'
import { AuthenticationRequiredError, createInstructorApi } from '@/api/instructor-v1'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toAppHref, type PublicEnvironment } from '@/config/environment'
import { PageHeader } from '@/components/product/PageHeader'
import { loginHref } from '@/auth/navigation'

export function AccountPanel({ account, api, environment }: {
  account: CanonicalInstructorMe
  api: ReturnType<typeof createInstructorApi>
  environment: PublicEnvironment
}) {
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState(account.display_name)
  useEffect(() => setDisplayName(account.display_name), [account.display_name])
  const profile = useMutation({
    mutationFn: (name: string) => api.updateProfile(name),
    onSuccess: (updated) => queryClient.setQueryData(['instructor-me', environment.name], updated),
  })

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!displayName.trim()) return
    profile.mutate(displayName.trim(), {
      onError: (error) => {
        if (error instanceof AuthenticationRequiredError) {
          window.location.replace(loginHref(environment, window.location.pathname))
        }
      },
    })
  }

  const home = toAppHref(environment, 'InstructorHome.html')
  const passwordHref = `${toAppHref(environment, 'InstructorPassword.html')}?${new URLSearchParams({ next: home })}`

  return <div className="max-w-4xl space-y-6">
    <PageHeader title="Account" description="Manage your instructor profile and sign-in." />
    <div className="grid gap-5 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle><h2>Profile</h2></CardTitle>
          <CardDescription>Your email address is managed by a LEAI administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={save}>
            <label className="block space-y-1.5 text-sm font-medium">Display name
              <Input autoComplete="name" maxLength={100} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">Email address
              <Input readOnly type="email" value={account.email} />
            </label>
            <Button disabled={profile.isPending || !displayName.trim()} type="submit">{profile.isPending ? 'Saving…' : 'Save profile'}</Button>
            {profile.isSuccess && <p className="text-sm text-success" role="status">Profile saved.</p>}
            {profile.isError && <p className="text-sm text-destructive" role="alert">Could not save your profile. Please try again.</p>}
          </form>
        </CardContent>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle><h2>Password</h2></CardTitle>
            <CardDescription>Change your password whenever you choose.</CardDescription>
          </CardHeader>
          <CardContent><Button asChild variant="outline"><a href={passwordHref}>Change password</a></Button></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><h2>Institution access</h2></CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {account.institutions.length > 0
              ? <ul className="space-y-1">{account.institutions.map((institution) => <li key={institution.slug}>{institution.name}</li>)}</ul>
              : <p>No institution assigned.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
}
