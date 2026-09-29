import { useId } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AuthenticationRequiredError, createInstructorApi, InstructorApiError } from '@/api/instructor-v1'
import { loginHref } from '@/auth/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import type { PublicEnvironment } from '@/config/environment'

export function CourseStudentSupportSettings({ api, courseId, environment, canManage }: {
  api: ReturnType<typeof createInstructorApi>
  courseId: string
  environment: PublicEnvironment
  canManage: boolean
}) {
  const queryClient = useQueryClient()
  const descriptionId = useId()
  const queryKey = ['course-referral-settings', environment.name, courseId]
  const settingsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.referralSettings(courseId, signal),
    enabled: canManage,
    retry: false,
  })
  const save = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!settingsQuery.data) throw new Error('Student support settings are not loaded.')
      return api.updateReferralSettings(courseId, {
        referral_enabled: enabled,
        expected_settings_version: settingsQuery.data.settings_version,
      })
    },
    onSuccess: async (settings) => {
      // A refetch begun before this PATCH must not overwrite its confirmed result.
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData(queryKey, settings)
      await Promise.all([
        'course-banner-settings', 'course-debug-settings', 'analysis-settings', 'student-pdf-settings',
      ].map((key) => queryClient.invalidateQueries({ queryKey: [key, environment.name, courseId] })))
    },
    onError: async (error) => {
      if (error instanceof InstructorApiError && error.status === 409) {
        // Retain the mutation's intended boolean, even if another editor already
        // changed the server value. A retry must never invert the refreshed value.
        await settingsQuery.refetch()
      }
    },
  })
  const errors = [settingsQuery.error, save.error]
  const expired = errors.some((error) => error instanceof AuthenticationRequiredError)
  const denied = !canManage || errors.some((error) => error instanceof InstructorApiError && error.status === 404)
  const conflict = save.error instanceof InstructorApiError && save.error.status === 409
  const enabled = settingsQuery.data?.referral_enabled ?? false

  return <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold">Student support</h2>
      <CardDescription className="text-base" id={descriptionId}>
        Off by default. When enabled, the AI can offer a gentle suggestion once per conversation to contact an instructor or TA when a student seems stuck.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 text-base">
      <p className="text-base text-muted-foreground">Turning this off applies to subsequent replies. No message or contact is actually sent.</p>
      {expired ? <p role="alert">Your sign-in has expired. <a className="font-medium text-primary underline" href={loginHref(environment, window.location.pathname)}>Sign in again</a>.</p>
        : denied ? <p role="status" className="text-muted-foreground">Only an instructor with course management access can view or change student support settings.</p>
          : <>
            {settingsQuery.isPending && <p role="status">Loading student support settings…</p>}
            {settingsQuery.isError && <div className="space-y-3">
              <p role="alert">Could not load student support settings.</p>
              <Button disabled={settingsQuery.isFetching} onClick={() => { void settingsQuery.refetch() }} type="button" variant="outline">Reload student support setting</Button>
            </div>}
            {settingsQuery.data && !settingsQuery.isError && <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
              <p className="min-w-0 font-medium">Suggest contacting an instructor or TA</p>
              <Switch aria-label="Suggest contacting an instructor or TA" aria-describedby={descriptionId}
                checked={enabled} disabled={save.isPending || settingsQuery.isFetching || conflict}
                onCheckedChange={(value) => save.mutate(value)} />
            </div>}
            {save.isPending && <p role="status">Saving student support setting…</p>}
            {save.isSuccess && settingsQuery.data?.referral_enabled === save.variables && <p role="status" className="text-success">Student support setting saved.</p>}
            {conflict && <div className="space-y-3">
              <p role="alert">This setting changed elsewhere. Your request to turn it {save.variables ? 'On' : 'Off'} has not been saved. Review the reloaded setting and retry.</p>
              <Button disabled={settingsQuery.isFetching || settingsQuery.isError || !settingsQuery.data}
                onClick={() => { if (save.variables !== undefined) save.mutate(save.variables) }} type="button" variant="outline">
                Retry turning {save.variables ? 'On' : 'Off'}
              </Button>
            </div>}
            {save.isError && !conflict && <p role="alert" className="text-destructive">Could not save the student support setting. Please try again.</p>}
          </>}
    </CardContent>
  </Card>
}
