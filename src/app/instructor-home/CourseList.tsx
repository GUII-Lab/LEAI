import type { CanonicalCourse } from '@/api/contracts/instructor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { qualifyBrowserKey, toAppHref, type PublicEnvironment } from '@/config/environment'

export function CourseList({ courses, environment, canCreate, selectedCourseId }: {
  courses: CanonicalCourse[]
  environment: PublicEnvironment
  canCreate: boolean
  selectedCourseId: string | null
}) {
  if (courses.length === 0) {
    return <section className="mt-6 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <h2 className="text-lg font-semibold">{canCreate ? 'Create your first course' : 'No courses available'}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{canCreate
        ? 'Your courses and feedback activities will appear here.'
        : 'Ask your LEAI administrator to grant you access to a course.'}</p>
    </section>
  }

  const orderedCourses = [...courses].sort((left, right) => {
    if (left.course_id === selectedCourseId) return -1
    if (right.course_id === selectedCourseId) return 1
    return left.course_name.localeCompare(right.course_name) || left.course_id.localeCompare(right.course_id)
  })

  return <section aria-label="Your courses" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {orderedCourses.map((course) => <article aria-label={course.course_name} key={course.course_id}><Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle><h2 className="text-lg font-semibold">{course.course_name}</h2></CardTitle>
          {course.course_id === selectedCourseId && <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Current</span>}
        </div>
        <p className="text-sm text-muted-foreground">{course.course_code}</p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{course.institution_slug}</span>
        <span>{course.role.replace('_', ' ')}</span>
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline">
          <a href={toAppHref(environment, 'FeedbackAnalyzer.html')}
            onClick={() => sessionStorage.setItem(qualifyBrowserKey(environment.name, 'selected-course'), course.course_id)}>
            Open feedback
          </a>
        </Button>
      </CardFooter>
    </Card></article>)}
  </section>
}
