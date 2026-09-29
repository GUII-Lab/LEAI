import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AuthenticationRequiredError, createInstructorApi, InstructorApiError } from '@/api/instructor-v1'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { qualifyBrowserKey, type PublicEnvironment } from '@/config/environment'
import { loginHref } from '@/auth/navigation'

type InstructorApi = ReturnType<typeof createInstructorApi>
type BannerSettings = Awaited<ReturnType<InstructorApi['courseBannerSettings']>>
type StudentPdfSettings = Awaited<ReturnType<InstructorApi['studentPdfSettings']>>
const defaultBannerText = "You're chatting with an AI assistant, not a person. It can make mistakes, so use your own judgment."

function CourseStudentPdfSettings({ api, courseId, environmentName }: {
  api: InstructorApi
  courseId: string
  environmentName: string
}) {
  const queryClient = useQueryClient()
  const queryKey = ['student-pdf-settings', environmentName, courseId]
  const settingsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.studentPdfSettings(courseId, signal),
    retry: false,
  })
  const save = useMutation({
    mutationFn: (settings: StudentPdfSettings) => api.updateStudentPdfSettings(courseId, {
      include_ai_conversation_in_student_pdf: !settings.include_ai_conversation_in_student_pdf,
      expected_settings_version: settings.settings_version,
    }),
    onSuccess: async (settings) => {
      queryClient.setQueryData(queryKey, settings)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course-banner-settings', environmentName, courseId] }),
        queryClient.invalidateQueries({ queryKey: ['course-debug-settings', environmentName, courseId] }),
        queryClient.invalidateQueries({ queryKey: ['analysis-settings', environmentName, courseId] }),
      ])
    },
  })
  const denied = settingsQuery.error instanceof InstructorApiError && settingsQuery.error.status === 404
  const conflict = save.error instanceof InstructorApiError && save.error.status === 409
  const enabled = settingsQuery.data?.include_ai_conversation_in_student_pdf ?? false

  return <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold">Student response PDF</h2>
      <CardDescription>Choose whether exported student PDFs include the AI conversation. Existing chat and analysis records are unchanged.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {settingsQuery.isPending && <p role="status">Loading student PDF settings…</p>}
      {denied && <p className="text-base text-muted-foreground" role="status">Only an instructor with course management access can view or change this setting.</p>}
      {settingsQuery.isError && !denied && <p role="alert">Could not load student PDF settings.</p>}
      {settingsQuery.data && <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold">Include AI conversation in student PDF</h3>
            <p className="mt-1 text-base text-muted-foreground">Off is the default and includes structured answers only. On also adds the student and AI conversation to the PDF.</p>
            <p className="mt-2 text-sm font-medium">{enabled ? 'On' : 'Off'}</p>
          </div>
          <Switch aria-label="Include AI conversation in student PDF" checked={enabled} disabled={save.isPending}
            onCheckedChange={() => save.mutate(settingsQuery.data)} />
        </div>
        {save.isPending && <p className="mt-3 text-sm text-muted-foreground" role="status">Saving setting…</p>}
        {save.isSuccess && <p className="mt-3 text-sm text-success" role="status">Student PDF setting saved.</p>}
        {conflict && <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive" role="alert">This setting changed elsewhere. Reload it before trying again.</p>
          <Button onClick={() => { save.reset(); void settingsQuery.refetch() }} type="button" variant="outline">Reload setting</Button>
        </div>}
        {save.isError && !conflict && <p className="mt-3 text-sm text-destructive" role="alert">Could not save the setting. Please try again.</p>}
      </section>}
    </CardContent>
  </Card>
}

function CourseBannerEditor({ api, courseId, environmentName }: {
  api: InstructorApi
  courseId: string
  environmentName: string
}) {
  const queryClient = useQueryClient()
  const queryKey = ['course-banner-settings', environmentName, courseId]
  const bannerQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.courseBannerSettings(courseId, signal),
    retry: false,
  })
  const [draftOverride, setDraftOverride] = useState<Omit<BannerSettings, 'settings_version'> | null>(null)
  const serverDraft = bannerQuery.data
    ? (({ settings_version: _version, ...settings }) => settings)(bannerQuery.data)
    : null
  const draft = draftOverride ?? serverDraft
  function updateDraft(patch: Partial<Omit<BannerSettings, 'settings_version'>>) {
    if (draft) setDraftOverride({ ...draft, ...patch })
  }
  const save = useMutation({
    mutationFn: (settings: Omit<BannerSettings, 'settings_version'>) =>
      api.updateCourseBannerSettings(courseId, {
        ...settings,
        expected_settings_version: bannerQuery.data?.settings_version ?? 0,
      }),
    onSuccess: async (settings) => {
      queryClient.setQueryData(queryKey, settings)
      setDraftOverride(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course-debug-settings', environmentName, courseId] }),
        queryClient.invalidateQueries({ queryKey: ['analysis-settings', environmentName, courseId] }),
        queryClient.invalidateQueries({ queryKey: ['student-pdf-settings', environmentName, courseId] }),
      ])
    },
  })
  const conflict = save.error instanceof InstructorApiError && save.error.status === 409

  return <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold">Course Banner</h2>
      <CardDescription>Set the notification students see on this course’s feedback surveys.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      {bannerQuery.isPending && <p role="status">Loading course banner settings…</p>}
      {bannerQuery.isError && <p role="alert">Could not load the course banner settings.</p>}
      {draft && <>
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div><h3 className="font-semibold">Show the banner to students</h3><p className="mt-1 text-base text-muted-foreground">When off, students see no banner.</p></div>
            <Switch aria-label="Show the banner to students" checked={draft.banner_enabled} disabled={save.isPending}
              onCheckedChange={(banner_enabled) => updateDraft({ banner_enabled })} />
          </div>
        </section>
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div><h3 className="font-semibold">Banner text</h3><p className="mt-1 text-base text-muted-foreground">Leave blank to use the default disclaimer. Up to 2,000 characters.</p></div>
          <Textarea aria-label="Banner text" maxLength={2000} value={draft.banner_text}
            onChange={(event) => updateDraft({ banner_text: event.target.value })} />
          <Button onClick={() => updateDraft({ banner_text: '' })} type="button" variant="outline">Use default disclaimer</Button>
        </section>
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold">Display behavior</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-base">Display duration
              <select aria-label="Display duration" className="h-10 w-full rounded-lg border border-input bg-background px-3" value={draft.banner_display_mode}
                onChange={(event) => updateDraft({ banner_display_mode: event.target.value as BannerSettings['banner_display_mode'] })}>
                <option value="persistent">Until the student closes it</option><option value="timed">Automatically dismiss</option>
              </select>
            </label>
            {draft.banner_display_mode === 'timed' && <label className="space-y-2 text-base">Auto-dismiss after (seconds)
              <Input aria-label="Auto-dismiss after seconds" max={600} min={1} type="number" value={draft.banner_duration_seconds}
                onChange={(event) => updateDraft({ banner_duration_seconds: Number(event.target.value) })} />
            </label>}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><h4 className="font-medium">Allow students to close it</h4><p className="mt-1 text-base text-muted-foreground">Adds a close button to the banner.</p></div>
            <Switch aria-label="Allow students to close the banner" checked={draft.banner_dismissible}
              onCheckedChange={(banner_dismissible) => updateDraft({ banner_dismissible })} />
          </div>
        </section>
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div><h3 className="font-semibold">Anonymous A/B split</h3><p className="mt-1 text-base text-muted-foreground">Show the banner to a random share of students; the rest are a silent control group.</p></div>
            <Switch aria-label="Enable anonymous A/B split" checked={draft.banner_split_enabled}
              onCheckedChange={(banner_split_enabled) => updateDraft({ banner_split_enabled })} />
          </div>
          {draft.banner_split_enabled && <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-base">Split by
              <select aria-label="Split by" className="h-10 w-full rounded-lg border border-input bg-background px-3" value={draft.banner_split_mode}
                onChange={(event) => updateDraft({ banner_split_mode: event.target.value as BannerSettings['banner_split_mode'], banner_split_value: event.target.value === 'count' ? 20 : 50 })}>
                <option value="percentage">Percentage of students</option><option value="count">Number of students</option>
              </select>
            </label>
            <label className="space-y-2 text-base">{draft.banner_split_mode === 'percentage' ? 'Percentage (0–100)' : 'Student count (minimum 1)'}
              <Input aria-label={draft.banner_split_mode === 'percentage' ? 'Banner split percentage' : 'Banner split count'}
                max={draft.banner_split_mode === 'percentage' ? 100 : 100000} min={draft.banner_split_mode === 'percentage' ? 0 : 1}
                type="number" value={draft.banner_split_value}
                onChange={(event) => updateDraft({ banner_split_value: Number(event.target.value) })} />
            </label>
          </div>}
        </section>
        <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <h3 className="font-semibold">Student preview</h3>
          {draft.banner_enabled
            ? <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-foreground">
              <span aria-hidden="true">ⓘ</span><p className="min-w-0 flex-1">{draft.banner_text.trim() || defaultBannerText}</p>
              {draft.banner_dismissible && <button aria-label="Preview close banner" className="rounded px-2" type="button">×</button>}
            </div>
            : <p className="text-base text-muted-foreground">Banner is off. Students won’t see anything.</p>}
          {draft.banner_enabled && draft.banner_display_mode === 'timed' && <p className="text-sm text-muted-foreground">Auto-dismisses after {draft.banner_duration_seconds} seconds.</p>}
          {draft.banner_enabled && draft.banner_split_enabled && <p className="text-sm text-muted-foreground">A/B: {draft.banner_split_mode === 'count' ? 'the first ' + draft.banner_split_value + ' students' : 'about ' + draft.banner_split_value + '% of students'} see this; the rest see nothing.</p>}
        </section>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={save.isPending} onClick={() => save.mutate(draft)} type="button">Save banner</Button>
          {save.isPending && <p role="status">Saving course banner…</p>}
          {save.isSuccess && <p className="text-sm text-success" role="status">Course banner saved.</p>}
          {conflict && <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-destructive" role="alert">These settings changed elsewhere. Reload before saving.</p><Button onClick={() => { save.reset(); setDraftOverride(null); void bannerQuery.refetch() }} type="button" variant="outline">Reload settings</Button></div>}
          {save.isError && !conflict && <p className="text-sm text-destructive" role="alert">Could not save the course banner.</p>}
        </div>
      </>}
    </CardContent>
  </Card>
}

export function CustomizationsPage({ api, environment, verified }: {
  api?: InstructorApi
  environment: PublicEnvironment
  verified: boolean
}) {
  const queryClient = useQueryClient()
  const courseKey = qualifyBrowserKey(environment.name, 'selected-course')
  const selectedId = sessionStorage.getItem(courseKey) ?? ''
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
  const selectedCourseId = courses.some((course) => course.course_id === selectedId) ? selectedId : ''
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
      void queryClient.invalidateQueries({ queryKey: ['course-banner-settings', environment.name, selectedCourseId] })
      void queryClient.invalidateQueries({ queryKey: ['student-pdf-settings', environment.name, selectedCourseId] })
      void queryClient.invalidateQueries({ queryKey: ['analysis-settings', environment.name, selectedCourseId] })
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
      void queryClient.invalidateQueries({ queryKey: ['course-banner-settings', environment.name, selectedCourseId] })
      void queryClient.invalidateQueries({ queryKey: ['student-pdf-settings', environment.name, selectedCourseId] })
      void queryClient.invalidateQueries({ queryKey: ['course-debug-settings', environment.name, selectedCourseId] })
    },
  })

  const settingsError = settingsQuery.error
  const researcherDenied = settingsError instanceof InstructorApiError && settingsError.status === 404
  const sessionExpired = settingsError instanceof AuthenticationRequiredError
    || coursesQuery.error instanceof AuthenticationRequiredError
  const conflict = update.error instanceof InstructorApiError && update.error.status === 409
  const matchingDenied = matchingSettingsQuery.error instanceof InstructorApiError && matchingSettingsQuery.error.status === 404
  const matchingConflict = matchingUpdate.error instanceof InstructorApiError && matchingUpdate.error.status === 409

  if (!verified) return <p className="mt-6 text-base text-muted-foreground" role="status">Waiting for backend identity verification before loading course settings.</p>

  return <div className="mt-6 max-w-3xl space-y-5">
    {coursesQuery.isPending && <p role="status">Loading courses…</p>}
    {coursesQuery.isError && !sessionExpired && <p role="alert">Could not load course settings. Please try again.</p>}
    {sessionExpired && <p role="alert">Your sign-in has expired. <a className="font-medium text-primary underline" href={loginHref(environment, window.location.pathname)}>Sign in again</a>.</p>}
    {coursesQuery.isSuccess && courses.length === 0 && <p className="text-base text-muted-foreground">No active courses are available for this account.</p>}

    {courses.length > 0 && selectedCourseId && <>
      <CourseBannerEditor api={activeApi} courseId={selectedCourseId} environmentName={environment.name} key={`banner-${selectedCourseId}`} />
      <CourseStudentPdfSettings api={activeApi} courseId={selectedCourseId} environmentName={environment.name} key={`student-pdf-${selectedCourseId}`} />
    </>}

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
