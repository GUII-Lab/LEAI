import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AuthenticationRequiredError, createInstructorApi, InstructorApiError } from '@/api/instructor-v1'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { qualifyBrowserKey, type PublicEnvironment } from '@/config/environment'
import { loginHref } from '@/auth/navigation'

type InstructorApi = ReturnType<typeof createInstructorApi>

export function CustomizationsPage({ api, environment, verified }: {
  api?: InstructorApi
  environment: PublicEnvironment
  verified: boolean
}) {
  const queryClient = useQueryClient()
  const courseKey = qualifyBrowserKey(environment.name, 'selected-course')
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem(courseKey) ?? '')
  const activeApi = useMemo(
    () => api ?? createInstructorApi(environment, () => verified),
    [api, environment, verified],
  )
  const coursesQuery = useQuery({
    queryKey: ['instructor-courses', environment.name],
    queryFn: ({ signal }) => activeApi.courses(signal),
    enabled: verified,
    retry: false,
  })
  const courses = coursesQuery.data?.courses ?? []
  const selectedCourseId = courses.find((course) => course.course_id === selectedId)?.course_id
    ?? courses[0]?.course_id ?? ''
  const settingsQuery = useQuery({
    queryKey: ['course-debug-settings', environment.name, selectedCourseId],
    queryFn: ({ signal }) => activeApi.debugSettings(selectedCourseId, signal),
    enabled: verified && Boolean(selectedCourseId) && environment.name !== 'production',
    retry: false,
  })
  const update = useMutation({
    mutationFn: ({ enabled, version }: { enabled: boolean; version: number }) =>
      activeApi.updateDebugSettings(selectedCourseId, enabled, version),
    onSuccess: (settings) => {
      queryClient.setQueryData(['course-debug-settings', environment.name, selectedCourseId], settings)
    },
  })
  const matchingSettingsQuery = useQuery({
    queryKey: ['analysis-settings', environment.name, selectedCourseId],
    queryFn: ({ signal }) => activeApi.settings(selectedCourseId, signal),
    enabled: verified && Boolean(selectedCourseId),
    retry: false,
  })
  const matchingUpdate = useMutation({
    mutationFn: ({ enabled, version }: { enabled: boolean; version: number }) =>
      activeApi.updateSettings(selectedCourseId, { anonymous_matching_enabled: enabled, expected_settings_version: version }),
    onSuccess: (settings) => {
      queryClient.setQueryData(['analysis-settings', environment.name, selectedCourseId], settings)
    },
  })

  useEffect(() => {
    if (!coursesQuery.data) return
    if (selectedCourseId) sessionStorage.setItem(courseKey, selectedCourseId)
    else sessionStorage.removeItem(courseKey)
  }, [courseKey, coursesQuery.data, selectedCourseId])

  function chooseCourse(id: string) {
    setSelectedId(id)
    sessionStorage.setItem(courseKey, id)
    update.reset()
  }

  const settingsError = settingsQuery.error
  const researcherDenied = settingsError instanceof InstructorApiError && settingsError.status === 404
  const sessionExpired = settingsError instanceof AuthenticationRequiredError
    || coursesQuery.error instanceof AuthenticationRequiredError
  const conflict = update.error instanceof InstructorApiError && update.error.status === 409
  const matchingDenied = matchingSettingsQuery.error instanceof InstructorApiError && matchingSettingsQuery.error.status === 404
  const matchingConflict = matchingUpdate.error instanceof InstructorApiError && matchingUpdate.error.status === 409

  if (!verified) return <p className="mt-6 text-base text-muted-foreground" role="status">Waiting for backend identity verification before loading course settings.</p>

  return <div className="mt-6 max-w-3xl space-y-5">
    {courses.length > 0 && <label className="block max-w-xl space-y-1.5 text-base font-medium">Course
      <select aria-label="Course" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        disabled={coursesQuery.isPending} onChange={(event) => chooseCourse(event.target.value)} value={selectedCourseId}>
        {courses.map((course) => <option key={course.course_id} value={course.course_id}>{course.course_name} · {course.course_code}</option>)}
      </select>
    </label>}
    {coursesQuery.isPending && <p role="status">Loading courses…</p>}
    {coursesQuery.isError && !sessionExpired && <p role="alert">Could not load course settings. Please try again.</p>}
    {sessionExpired && <p role="alert">Your sign-in has expired. <a className="font-medium text-primary underline" href={loginHref(environment, window.location.pathname)}>Sign in again</a>.</p>}
    {coursesQuery.isSuccess && courses.length === 0 && <p className="text-base text-muted-foreground">No active courses are available for this account.</p>}

    {courses.length > 0 && <Card>
      <CardHeader>
        <h2 className="text-base font-semibold">AI debug visibility</h2>
        <CardDescription>Optional diagnostic state for research testing. Off by default and available only in QA.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {environment.name === 'production' ? <p className="text-sm text-muted-foreground">AI debug state is disabled in Production.</p>
          : settingsQuery.isPending ? <p role="status">Checking Researcher access…</p>
            : researcherDenied ? <p className="text-base text-muted-foreground" role="status">Only an authorized institutional Researcher can view or change this course setting.</p>
              : settingsQuery.isError ? <p className="text-sm text-muted-foreground" role="alert">Could not load the Researcher debug setting.</p>
                : settingsQuery.data && <>
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Enable AI debug panel</p>
                      <p className="mt-1 text-base text-muted-foreground">When enabled, signed-in Researchers with access to this course can open saved AI decisions and answer mappings beneath messages in the student conversation. Students and instructors cannot view this panel.</p>
                    </div>
                    <button aria-checked={settingsQuery.data.debug_enabled} aria-label="Enable AI debug panel"
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${settingsQuery.data.debug_enabled ? 'bg-primary' : 'bg-muted'}`}
                      data-state={settingsQuery.data.debug_enabled ? 'checked' : 'unchecked'} disabled={update.isPending}
                      onClick={() => update.mutate({ enabled: !settingsQuery.data.debug_enabled, version: settingsQuery.data.settings_version })}
                      role="switch" type="button">
                      <span aria-hidden="true" className={`size-5 rounded-full bg-background shadow-sm transition-transform ${settingsQuery.data.debug_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {update.isPending && <p role="status">Saving setting…</p>}
                  {update.isSuccess && <p className="text-sm text-success" role="status">Researcher debug setting saved.</p>}
                  {conflict && <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-destructive" role="alert">This setting changed elsewhere. Reload it before trying again.</p><Button onClick={() => { update.reset(); void settingsQuery.refetch() }} type="button" variant="outline">Reload setting</Button></div>}
                  {update.isError && !conflict && <p className="text-sm text-destructive" role="alert">Could not save the setting. Please try again.</p>}
                </>}
      </CardContent>
    </Card>}

    {courses.length > 0 && <Card>
      <CardHeader>
        <h2 className="text-base font-semibold">Anonymous cross-week matching</h2>
        <CardDescription>Optional course setting. LEAI groups returning browser sessions under anonymous labels; it does not use student names or rosters.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {matchingSettingsQuery.isPending ? <p role="status">Checking course access…</p>
          : matchingDenied ? <p className="text-base text-muted-foreground" role="status">Only an authorized course manager can view or change this setting.</p>
            : matchingSettingsQuery.isError ? <p className="text-sm text-destructive" role="alert">Could not load the anonymous matching setting.</p>
              : matchingSettingsQuery.data && <>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Enable anonymous cross-week matching</p>
                    <p className="mt-1 text-base text-muted-foreground">When enabled, the student page sends the existing browser device key and optional fingerprint signal. The backend stores environment-scoped digests, and Analyzer shows arbitrary labels such as S1.</p>
                  </div>
                  <Switch aria-label="Enable anonymous cross-week matching" checked={matchingSettingsQuery.data.anonymous_matching_enabled}
                    disabled={matchingUpdate.isPending} onCheckedChange={(enabled) => matchingUpdate.mutate({
                      enabled, version: matchingSettingsQuery.data.settings_version,
                    })} />
                </div>
                {matchingUpdate.isPending && <p role="status">Saving setting…</p>}
                {matchingUpdate.isSuccess && <p className="text-sm text-success" role="status">Anonymous matching setting saved.</p>}
                {matchingConflict && <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-destructive" role="alert">This setting changed elsewhere. Reload it before trying again.</p><Button onClick={() => { matchingUpdate.reset(); void matchingSettingsQuery.refetch() }} type="button" variant="outline">Reload setting</Button></div>}
                {matchingUpdate.isError && !matchingConflict && <p className="text-sm text-destructive" role="alert">Could not save the anonymous matching setting. Please try again.</p>}
              </>}
      </CardContent>
    </Card>}
  </div>
}
