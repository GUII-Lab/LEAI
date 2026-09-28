import { useEffect, useState, type ReactNode } from 'react'
import { AuthenticationRequiredError, createInstructorApi, InstructorApiError } from '@/api/instructor-v1'
import { Button } from '@/components/ui/button'
import { qualifyBrowserKey, toAppHref, type PublicEnvironment } from '@/config/environment'
import { loginHref } from '@/auth/navigation'

type RouteStatus = 'checking' | 'ready' | 'error'

export function CourseRouteGate({ environment, children }: {
  environment: PublicEnvironment
  children: ReactNode
}) {
  const [status, setStatus] = useState<RouteStatus>('checking')
  const [errorMessage, setErrorMessage] = useState('We couldn’t verify access to this course. Please try again.')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const selectionKey = qualifyBrowserKey(environment.name, 'selected-course')
    const selectedCourseId = sessionStorage.getItem(selectionKey)
    const notFoundHref = toAppHref(environment, 'NotFound.html')

    const redirectToNotFound = () => {
      sessionStorage.removeItem(selectionKey)
      window.location.replace(notFoundHref)
    }

    if (!selectedCourseId) {
      redirectToNotFound()
      return () => { active = false }
    }

    void createInstructorApi(environment, () => true).courses().then(({ courses }) => {
      if (!active) return
      const selectedCourseIsAccessible = courses.some((course) =>
        course.course_id === selectedCourseId && course.lifecycle_state === 'active')
      if (!selectedCourseIsAccessible) {
        redirectToNotFound()
        return
      }
      setStatus('ready')
    }).catch((error: unknown) => {
      if (!active) return
      if (error instanceof AuthenticationRequiredError) {
        sessionStorage.removeItem(qualifyBrowserKey(environment.name, 'instructor-token'))
        sessionStorage.removeItem(selectionKey)
        window.location.replace(loginHref(environment, window.location.pathname))
        return
      }
      if (error instanceof InstructorApiError && error.status === 403) {
        setErrorMessage('Your account does not have permission to access courses.')
      } else {
        setErrorMessage('We couldn’t verify access to this course. Please try again.')
      }
      setStatus('error')
    })

    return () => { active = false }
  }, [attempt, environment])

  if (status === 'ready') return children
  if (status === 'error') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p role="alert">{errorMessage}</p>
        <Button onClick={() => { setStatus('checking'); setAttempt((value) => value + 1) }} variant="outline">
          Retry
        </Button>
      </main>
    )
  }
  return <main className="flex min-h-dvh items-center justify-center px-4 text-center"><p role="status">Checking course access…</p></main>
}
