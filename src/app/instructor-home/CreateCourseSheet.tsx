import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createInstructorApi, InstructorApiError } from '@/api/instructor-v1'
import type { CanonicalCourse, CanonicalInstructorMe } from '@/api/contracts/instructor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

export function CreateCourseSheet({ account, api, onCreated }: {
  account: CanonicalInstructorMe
  api: ReturnType<typeof createInstructorApi>
  onCreated: (course: CanonicalCourse) => void
}) {
  const institutions = account.institutions.filter((institution) => institution.can_create_courses)
  const [open, setOpen] = useState(false)
  const [institutionSlug, setInstitutionSlug] = useState(institutions[0]?.slug ?? '')
  const [courseName, setCourseName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const create = useMutation({
    mutationFn: () => api.createCourse({
      institution_slug: institutionSlug,
      course_code: courseCode.trim(),
      course_name: courseName.trim(),
    }),
    onSuccess: (course) => {
      onCreated(course)
      setCourseName('')
      setCourseCode('')
      setOpen(false)
    },
  })

  if (institutions.length === 0) return null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate()
  }

  const conflict = create.error instanceof InstructorApiError && create.error.code === 'course_code_taken'

  return <Sheet open={open} onOpenChange={(next) => { setOpen(next); if (next) create.reset() }}>
    <SheetTrigger asChild><Button type="button">Create course</Button></SheetTrigger>
    <SheetContent className="max-w-full sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Create a course</SheetTitle>
        <SheetDescription>Set up the course identity before adding feedback activities.</SheetDescription>
      </SheetHeader>
      <form className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4" id="create-course-form" onSubmit={submit}>
        <label className="space-y-1.5 text-base font-medium">Institution
          <select className="h-9 w-full rounded-lg border border-input bg-background px-3 text-base" onChange={(event) => setInstitutionSlug(event.target.value)} required value={institutionSlug}>
            {institutions.map((institution) => <option key={institution.slug} value={institution.slug}>{institution.name}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-base font-medium">Course name
          <Input maxLength={200} onChange={(event) => setCourseName(event.target.value)} required value={courseName} />
        </label>
        <label className="space-y-1.5 text-base font-medium">Course code
          <Input autoCapitalize="none" autoComplete="off" maxLength={100} onChange={(event) => setCourseCode(event.target.value.toLowerCase())} pattern="[a-z0-9-]+" required value={courseCode} />
        </label>
        <p className="text-xs text-muted-foreground">Use lowercase letters, numbers, and hyphens for the course code.</p>
        {conflict && <p className="text-sm text-destructive" role="alert">That course code is already used in this institution.</p>}
        {create.isError && !conflict && <p className="text-sm text-destructive" role="alert">Could not create the course. Please try again.</p>}
      </form>
      <SheetFooter className="flex-row justify-end border-t border-border">
        <Button onClick={() => setOpen(false)} type="button" variant="outline">Cancel</Button>
        <Button disabled={create.isPending} form="create-course-form" type="submit">{create.isPending ? 'Creating…' : 'Create course'}</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
}
