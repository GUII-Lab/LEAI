import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { CanonicalCourse, CanonicalInstructorMe } from '@/api/contracts/instructor'
import { getEnvironment } from '@/config/environment'
import { AuthenticationRequiredError, InstructorApiError } from '@/api/instructor-v1'
import { InstructorHomePage } from './InstructorHomePage'

const environment = getEnvironment({})
const course: CanonicalCourse = {
  course_id: '11111111-1111-4111-8111-111111111111',
  course_code: 'cmpm-80h', course_name: 'Game Design', institution_slug: 'ucsc',
  lifecycle_state: 'active', role: 'owner', allowed_actions: ['course.manage', 'feedback.author'],
}
const account: CanonicalInstructorMe = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'teacher@ucsc.edu', display_name: 'Teacher', must_change_password: false,
  platform_role: 'member', institutions: [{ slug: 'ucsc', name: 'UC Santa Cruz', can_create_courses: true }],
}
type Api = NonNullable<Parameters<typeof InstructorHomePage>[0]['api']>

function renderHome(overrides: { courses?: CanonicalCourse[]; account?: CanonicalInstructorMe; rejectCourses?: boolean; expiredSession?: boolean } = {}) {
  const currentCourses = overrides.courses ?? [course]
  const api = {
    me: vi.fn().mockImplementation(async () => {
      if (overrides.expiredSession) throw new AuthenticationRequiredError()
      return overrides.account ?? account
    }),
    courses: vi.fn().mockImplementation(async () => {
      if (overrides.rejectCourses) throw new Error('unavailable')
      return { courses: currentCourses }
    }),
    createCourse: vi.fn().mockImplementation(async () => course),
    updateProfile: vi.fn().mockImplementation(async (name: string) => ({ ...account, display_name: name })),
    logout: vi.fn().mockResolvedValue(undefined),
  } as unknown as Api
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><InstructorHomePage api={api} environment={environment} verified /></QueryClientProvider>)
  return { api, client }
}

beforeEach(() => {
  sessionStorage.clear()
  window.history.replaceState({}, '', '/InstructorHome.html')
})

it('shows authorized courses and selects one for the implemented feedback tool', async () => {
  const user = userEvent.setup()
  renderHome()

  const card = await screen.findByRole('article', { name: /Game Design/ })
  expect(within(card).getByText('cmpm-80h')).toBeInTheDocument()
  expect(within(card).getByText(/UC Santa Cruz|ucsc/)).toBeInTheDocument()
  const open = within(card).getByRole('link', { name: 'Open Game Design' })
  expect(open).toHaveAttribute('href', '/FeedbackAnalyzer.html')
  expect(within(card).queryByText('Open feedback')).not.toBeInTheDocument()
  open.addEventListener('click', (event) => event.preventDefault())
  await user.click(within(card).getByRole('heading', { name: 'Game Design' }))
  expect(sessionStorage.getItem('leai:local:selected-course')).toBe(course.course_id)
})

it('places the selected course first and marks it as current', async () => {
  const other = { ...course, course_id: '33333333-3333-4333-8333-333333333333', course_name: 'A New Course' }
  sessionStorage.setItem('leai:local:selected-course', course.course_id)
  renderHome({ courses: [other, course] })

  await screen.findByRole('article', { name: 'Game Design' })
  expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual(['Game Design', 'A New Course'])
  expect(within(screen.getByRole('article', { name: 'Game Design' })).getByText('Current')).toBeInTheDocument()
})

it('clears a selected course that is no longer accessible', async () => {
  sessionStorage.setItem('leai:local:selected-course', '99999999-9999-4999-8999-999999999999')
  renderHome()

  expect(await screen.findByText(/previously selected course is no longer available/)).toBeInTheDocument()
  expect(sessionStorage.getItem('leai:local:selected-course')).toBeNull()
})

it('does not mistake a load failure for an empty account and offers retry', async () => {
  const { api } = renderHome({ rejectCourses: true })
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your courses')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  expect(screen.queryByText('Create your first course')).not.toBeInTheDocument()
  expect(api.courses).toHaveBeenCalled()
})

it('removes the selected course when the instructor session has expired', async () => {
  sessionStorage.setItem('leai:local:selected-course', course.course_id)
  renderHome({ expiredSession: true })
  expect(await screen.findByText('Returning to sign-in…')).toBeInTheDocument()
  await waitFor(() => expect(sessionStorage.getItem('leai:local:selected-course')).toBeNull())
})

it('shows a create action for an empty instructor and not for a Researcher-only account', async () => {
  const first = renderHome({ courses: [] })
  expect(await screen.findByText('Create your first course')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create course' })).toBeInTheDocument()
  first.client.clear()
})

it('creates and selects a course from the empty account state', async () => {
  const user = userEvent.setup()
  const { api } = renderHome({ courses: [] })
  await screen.findByText('Create your first course')
  await user.click(screen.getByRole('button', { name: 'Create course' }))
  const dialog = screen.getByRole('dialog', { name: 'Create a course' })
  await user.type(within(dialog).getByRole('textbox', { name: 'Course name' }), 'Game Design')
  await user.type(within(dialog).getByRole('textbox', { name: 'Course code' }), 'cmpm-80h')
  await user.click(within(dialog).getByRole('button', { name: 'Create course' }))
  await waitFor(() => expect(api.createCourse).toHaveBeenCalledWith({
    institution_slug: 'ucsc', course_code: 'cmpm-80h', course_name: 'Game Design',
  }))
  expect(await screen.findByRole('status')).toHaveTextContent('Course created')
  expect(sessionStorage.getItem('leai:local:selected-course')).toBe(course.course_id)
  expect(await screen.findByRole('article', { name: 'Game Design' })).toBeInTheDocument()
})

it('hides creation for a Researcher-only institution and explains no-course access', async () => {
  renderHome({ courses: [], account: {
    ...account, institutions: [{ slug: 'ucsc', name: 'UC Santa Cruz', can_create_courses: false }],
  } })
  expect(await screen.findByText('No courses available')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Create course' })).not.toBeInTheDocument()
})

it('keeps the creation form open on duplicate code without selecting an unsaved course', async () => {
  const user = userEvent.setup()
  const { api } = renderHome({ courses: [] })
  vi.mocked(api.createCourse).mockRejectedValue(new InstructorApiError(409, 'course_code_taken'))
  await screen.findByText('Create your first course')
  await user.click(screen.getByRole('button', { name: 'Create course' }))
  const dialog = screen.getByRole('dialog', { name: 'Create a course' })
  await user.type(within(dialog).getByRole('textbox', { name: 'Course name' }), 'Game Design')
  await user.type(within(dialog).getByRole('textbox', { name: 'Course code' }), 'cmpm-80h')
  await user.click(within(dialog).getByRole('button', { name: 'Create course' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('already used')
  expect(sessionStorage.getItem('leai:local:selected-course')).toBeNull()
})

it('shows account details and a voluntary password path without forced change', async () => {
  window.history.replaceState({}, '', '/InstructorHome.html?view=account')
  renderHome()
  expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument()
  expect(screen.getByDisplayValue('teacher@ucsc.edu')).toHaveAttribute('readonly')
  expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute('href', '/InstructorPassword.html?next=%2FInstructorHome.html')
  expect(screen.queryByText(/must change|password required/i)).not.toBeInTheDocument()
})

it('saves the profile display name through the canonical API', async () => {
  window.history.replaceState({}, '', '/InstructorHome.html?view=account')
  const user = userEvent.setup()
  const { api } = renderHome()
  const field = await screen.findByRole('textbox', { name: 'Display name' })
  await user.clear(field)
  await user.type(field, 'Updated Teacher')
  await user.click(screen.getByRole('button', { name: 'Save profile' }))
  await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith('Updated Teacher'))
  expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
})
