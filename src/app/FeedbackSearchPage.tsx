import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import { AuthenticationRequiredError, createInstructorApi, InstructorApiError } from '@/api/instructor-v1'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { qualifyBrowserKey, type PublicEnvironment } from '@/config/environment'
import { loginHref } from '@/auth/navigation'

type InstructorApi = ReturnType<typeof createInstructorApi>

export function FeedbackSearchPage({ api, environment, verified }: {
  api?: InstructorApi
  environment: PublicEnvironment
  verified: boolean
}) {
  const queryClient = useQueryClient()
  const tokenKey = qualifyBrowserKey(environment.name, 'instructor-token')
  const courseKey = qualifyBrowserKey(environment.name, 'selected-course')
  const [signedOut, setSignedOut] = useState(false)
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem(courseKey) ?? '')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const searchEpoch = useRef(0)
  const pendingSearch = useRef<AbortController | null>(null)
  const activeApi = useMemo(
    () => api ?? createInstructorApi(environment, () => verified),
    [api, environment, verified],
  )
  const {
    data: completedSearch,
    isPending: searchPending,
    mutateAsync: runSearch,
    reset: resetSearch,
    variables: searchVariables,
  } = useMutation({
    mutationFn: async ({ courseId, text, signal }: { courseId: string; text: string; signal: AbortSignal }) => ({
      courseId,
      response: await activeApi.search(courseId, text, signal),
    }),
    retry: false,
  })
  const clearSession = useCallback((message = '') => {
    pendingSearch.current?.abort()
    searchEpoch.current += 1
    void queryClient.cancelQueries()
    queryClient.clear()
    resetSearch()
    sessionStorage.removeItem(tokenKey)
    sessionStorage.removeItem(courseKey)
    setSignedOut(true)
    setSelectedId('')
    setError(message)
    window.location.replace(loginHref(environment, window.location.pathname))
  }, [courseKey, environment, queryClient, resetSearch, tokenKey])

  const courseQuery = useQuery({
    queryKey: ['instructor-courses', environment.name],
    queryFn: async ({ signal }) => {
      try {
        const response = await activeApi.courses(signal)
        return response.courses
      } catch (cause) {
        if (cause instanceof AuthenticationRequiredError) clearSession('Your session ended. Sign in again.')
        throw cause
      }
    },
    enabled: verified && !signedOut,
    retry: false,
  })
  const courses = courseQuery.data ?? []
  const loadingCourses = !signedOut && courseQuery.isPending
  const activeCourseId = courses.find((course) => course.course_id === selectedId)?.course_id
    ?? courses[0]?.course_id ?? ''
  const searchResult = completedSearch?.courseId === activeCourseId ? completedSearch.response : null
  const searching = searchPending && searchVariables?.courseId === activeCourseId

  useEffect(() => {
    if (!courseQuery.data) return
    if (activeCourseId) sessionStorage.setItem(courseKey, activeCourseId)
    else sessionStorage.removeItem(courseKey)
  }, [activeCourseId, courseKey, courseQuery.data])

  async function signOut() {
    try {
      await activeApi.logout()
      clearSession()
    } catch (cause) {
      if (cause instanceof AuthenticationRequiredError) clearSession()
      else setError('Sign-out could not finish. Please try again.')
    }
  }

  function chooseCourse(id: string) {
    pendingSearch.current?.abort()
    searchEpoch.current += 1
    resetSearch()
    setSelectedId(id)
    sessionStorage.setItem(courseKey, id)
    setError('')
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = query.trim()
    if (!activeCourseId || text.length < 2 || text.length > 100) return
    pendingSearch.current?.abort()
    const controller = new AbortController()
    pendingSearch.current = controller
    const epoch = ++searchEpoch.current
    resetSearch()
    setError('')
    try {
      await runSearch({ courseId: activeCourseId, text, signal: controller.signal })
    } catch (cause) {
      if (epoch !== searchEpoch.current || controller.signal.aborted) return
      if (cause instanceof AuthenticationRequiredError) clearSession('Your session ended. Sign in again.')
      else if (cause instanceof InstructorApiError && cause.status === 404) {
        setError('You no longer have access to this course. Choose another course.')
      } else setError('Search could not be completed. Please try again.')
    } finally {
      if (epoch === searchEpoch.current) pendingSearch.current = null
    }
  }

  if (!verified) {
    return <p className="mt-6 text-base text-muted-foreground">Waiting for backend identity verification before opening instructor feedback.</p>
  }

  if (signedOut) return <p className="mt-6 text-base text-muted-foreground" role="status">Returning to sign-in…</p>

  const selectedCourse = courses.find((course) => course.course_id === activeCourseId)
  const canSearch = selectedCourse?.allowed_actions.includes('responses.view') ?? false
  const courseError = courseQuery.error
  const visibleError = error || (courseError && !(courseError instanceof AuthenticationRequiredError)
      ? 'Could not load your courses. Please try again.'
      : '')

  return (
    <div className="mt-6 max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-1.5 text-base font-medium">Course
          <select
            className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={loadingCourses || courses.length === 0}
            onChange={(event) => chooseCourse(event.target.value)}
            value={activeCourseId}
          >
            {courses.length === 0 && <option value="">No courses available</option>}
            {courses.map((course) => <option key={course.course_id} value={course.course_id}>{course.course_name} · {course.course_code}</option>)}
          </select>
        </label>
        <Button onClick={() => void signOut()} type="button" variant="outline">Sign out</Button>
      </div>
      {visibleError && <p className="text-sm text-destructive" role="alert">{visibleError}</p>}
      {loadingCourses ? <p role="status">Loading your courses…</p> : courseQuery.isError ? (
        <Button onClick={() => void courseQuery.refetch()} type="button" variant="outline">Retry loading courses</Button>
      ) : courses.length === 0 ? (
        <p className="text-base text-muted-foreground">No active courses are available for this account.</p>
      ) : !canSearch ? (
        <p className="text-base text-muted-foreground">You do not have permission to view responses for this course.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Search student responses</CardTitle>
            <CardDescription>Search completed responses in this course. Preview and unfinished responses are excluded.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void search(event)} role="search">
              <label className="min-w-0 flex-1 space-y-1.5 text-base font-medium">
                <span className="sr-only">Search student responses</span>
                <Input aria-label="Search student responses" maxLength={100} minLength={2} onChange={(event) => setQuery(event.target.value)} placeholder="Search a word or phrase" required type="search" value={query} />
              </label>
              <Button disabled={searching || query.trim().length < 2} type="submit"><SearchIcon aria-hidden="true" />{searching ? 'Searching…' : 'Search'}</Button>
            </form>
            {searching && <p className="text-sm text-muted-foreground" role="status">Searching responses…</p>}
            {searchResult && (
              <div className="space-y-3" aria-live="polite">
                <p className="text-sm text-muted-foreground">{searchResult.results.length === 0 ? 'No matching responses found.' : `${searchResult.results.length} matching response${searchResult.results.length === 1 ? '' : 's'}${searchResult.has_more ? ' shown. Refine your search for more.' : ''}`}</p>
                <ul className="space-y-3">
                  {searchResult.results.map((result) => (
                    <li className="rounded-lg border border-border bg-background p-4" key={result.message_id}>
                      <p className="text-xs font-semibold text-muted-foreground">{result.occurrence_label}</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-base">{result.excerpt}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
