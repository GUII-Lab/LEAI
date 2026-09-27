import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AuthenticationRequiredError, createInstructorApi } from '@/api/instructor-v1'
import type { CanonicalCourse } from '@/api/contracts/instructor'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/product/PageHeader'
import { qualifyBrowserKey, type PublicEnvironment } from '@/config/environment'
import { loginHref } from '@/auth/navigation'
import { AccountPanel } from './instructor-home/AccountPanel'
import { CourseList } from './instructor-home/CourseList'
import { CreateCourseSheet } from './instructor-home/CreateCourseSheet'

export function InstructorHomePage({ api, environment, verified }: {
  api?: ReturnType<typeof createInstructorApi>
  environment: PublicEnvironment
  verified: boolean
}) {
  const queryClient = useQueryClient()
  const activeApi = useMemo(() => api ?? createInstructorApi(environment, () => verified), [api, environment, verified])
  const [created, setCreated] = useState(false)
  const [selectionNotice, setSelectionNotice] = useState(false)
  const isAccount = new URLSearchParams(window.location.search).get('view') === 'account'
  const accountQuery = useQuery({
    queryKey: ['instructor-me', environment.name],
    queryFn: ({ signal }) => activeApi.me(signal),
    enabled: verified,
    retry: false,
  })
  const coursesQuery = useQuery({
    queryKey: ['instructor-courses', environment.name],
    queryFn: ({ signal }) => activeApi.courses(signal),
    enabled: verified && !isAccount,
    retry: false,
  })

  useEffect(() => {
    if (!(accountQuery.error instanceof AuthenticationRequiredError)
      && !(coursesQuery.error instanceof AuthenticationRequiredError)) return
    queryClient.clear()
    sessionStorage.removeItem(qualifyBrowserKey(environment.name, 'selected-course'))
    window.location.replace(loginHref(environment, window.location.pathname))
  }, [accountQuery.error, coursesQuery.error, environment, queryClient])

  useEffect(() => {
    if (!coursesQuery.isSuccess) return
    const selectionKey = qualifyBrowserKey(environment.name, 'selected-course')
    const selectedId = sessionStorage.getItem(selectionKey)
    if (selectedId && !coursesQuery.data.courses.some((course) => course.course_id === selectedId)) {
      sessionStorage.removeItem(selectionKey)
      setSelectionNotice(true)
    }
  }, [coursesQuery.data, coursesQuery.isSuccess, environment.name])

  if (!verified) return <p role="status">Checking the LEAI service…</p>
  if (accountQuery.isPending || (!isAccount && coursesQuery.isPending)) return <p role="status">Loading your workspace…</p>
  if (accountQuery.isError || (!isAccount && coursesQuery.isError)) {
    if (accountQuery.error instanceof AuthenticationRequiredError || coursesQuery.error instanceof AuthenticationRequiredError) {
      return <p role="status">Returning to sign-in…</p>
    }
    return <div className="mt-6 space-y-3">
      <p role="alert">Could not load your courses or account. Please try again.</p>
      <Button onClick={() => { void accountQuery.refetch(); if (!isAccount) void coursesQuery.refetch() }} variant="outline">Retry</Button>
    </div>
  }

  const account = accountQuery.data
  if (isAccount) return <AccountPanel account={account} api={activeApi} environment={environment} />

  const courses = coursesQuery.data?.courses ?? []
  const canCreate = account.institutions.some((institution) => institution.can_create_courses)
  function courseCreated(course: CanonicalCourse) {
    queryClient.setQueryData<{ courses: CanonicalCourse[] }>(['instructor-courses', environment.name], (previous) => ({
      courses: [...(previous?.courses ?? []).filter((row) => row.course_id !== course.course_id), course],
    }))
    sessionStorage.setItem(qualifyBrowserKey(environment.name, 'selected-course'), course.course_id)
    setCreated(true)
    setSelectionNotice(false)
  }

  return <div className="max-w-6xl">
    <PageHeader title="Your courses" description={`Welcome, ${account.display_name}. Open a course to review its feedback.`}
      actions={canCreate && <CreateCourseSheet account={account} api={activeApi} onCreated={courseCreated} />} />
    {created && <p className="mt-5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground" role="status">Course created. Open feedback to continue.</p>}
    {selectionNotice && <p className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-sm" role="status">Your previously selected course is no longer available. Choose another course to continue.</p>}
    <CourseList canCreate={canCreate} courses={courses} environment={environment}
      selectedCourseId={sessionStorage.getItem(qualifyBrowserKey(environment.name, 'selected-course'))} />
  </div>
}
