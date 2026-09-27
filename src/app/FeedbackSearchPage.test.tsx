import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getEnvironment } from '@/config/environment'
import { createInstructorApi } from '@/api/instructor-v1'
import { FeedbackSearchPage } from './FeedbackSearchPage'

const environment = getEnvironment({})
const courseId = '550e8400-e29b-41d4-a716-446655440000'
const course = {
  course_id: courseId,
  course_code: 'demo-course',
  course_name: 'Demo Course',
  institution_slug: 'demo',
  lifecycle_state: 'active' as const,
  role: 'owner' as const,
  allowed_actions: ['responses.view' as const],
}
const me = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  email: 'demo@example.edu',
  display_name: 'Demo Instructor',
  must_change_password: false,
  platform_role: 'member' as const,
  institutions: [],
}
const api = {
  login: vi.fn(), me: vi.fn(), courses: vi.fn(), search: vi.fn(), logout: vi.fn(),
} as unknown as ReturnType<typeof createInstructorApi>

function renderSearchPage(verified = true) {
  const client = new QueryClient()
  const rendered = render(
    <QueryClientProvider client={client}>
      <FeedbackSearchPage api={api} environment={environment} verified={verified} />
    </QueryClientProvider>,
  )
  return { ...rendered, client }
}

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(api.login).mockReset()
  vi.mocked(api.me).mockReset().mockResolvedValue(me)
  vi.mocked(api.courses).mockReset().mockResolvedValue({ courses: [course] })
  vi.mocked(api.search).mockReset().mockResolvedValue({
    query: 'capstone',
    results: [{
      message_id: 1,
      response_id: '550e8400-e29b-41d4-a716-446655440002',
      occurrence_label: 'Week 4 Reflection',
      excerpt: 'My capstone project helped me understand the process.',
      created_at: '2026-09-22T12:00:00Z',
    }],
    has_more: false,
  })
  vi.mocked(api.logout).mockReset().mockResolvedValue(undefined)
})

it('selects a permitted course and shows response excerpts for an existing instructor session', async () => {
  sessionStorage.setItem('leai:local:instructor-token', 'opaque-demo-token')
  const user = userEvent.setup()
  renderSearchPage()

  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Course' })).toHaveValue(courseId))
  expect(sessionStorage.getItem('leai:local:instructor-token')).toBe('opaque-demo-token')
  await user.type(screen.getByRole('searchbox', { name: 'Search student responses' }), 'capstone')
  await user.click(screen.getByRole('button', { name: 'Search' }))

  expect(await screen.findByText(/My capstone project/)).toBeInTheDocument()
  expect(api.search).toHaveBeenCalledWith(courseId, 'capstone', expect.any(AbortSignal))
})

it('does not show results from a prior course after switching courses', async () => {
  sessionStorage.setItem('leai:local:instructor-token', 'opaque-demo-token')
  const otherId = '550e8400-e29b-41d4-a716-446655440003'
  vi.mocked(api.courses).mockResolvedValue({ courses: [course, { ...course, course_id: otherId, course_name: 'Other Course' }] })
  const user = userEvent.setup()
  renderSearchPage()

  await user.type(await screen.findByRole('searchbox', { name: 'Search student responses' }), 'capstone')
  await user.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByText(/My capstone project/)).toBeInTheDocument()

  await user.selectOptions(screen.getByRole('combobox', { name: 'Course' }), otherId)
  expect(screen.queryByText(/My capstone project/)).not.toBeInTheDocument()
  expect(sessionStorage.getItem('leai:local:selected-course')).toBe(otherId)
})

it('hides old response excerpts if a refreshed course list revokes access', async () => {
  sessionStorage.setItem('leai:local:instructor-token', 'opaque-demo-token')
  const otherId = '550e8400-e29b-41d4-a716-446655440003'
  const otherCourse = { ...course, course_id: otherId, course_name: 'Other Course' }
  vi.mocked(api.courses).mockResolvedValue({ courses: [course, otherCourse] })
  const user = userEvent.setup()
  const { client } = renderSearchPage()

  await user.type(await screen.findByRole('searchbox', { name: 'Search student responses' }), 'capstone')
  await user.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByText(/My capstone project/)).toBeInTheDocument()

  vi.mocked(api.courses).mockResolvedValue({ courses: [otherCourse] })
  await client.invalidateQueries({ queryKey: ['instructor-courses', environment.name] })

  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Course' })).toHaveValue(otherId))
  expect(screen.queryByText(/My capstone project/)).not.toBeInTheDocument()
})

it('does not call protected APIs until the environment is verified', () => {
  sessionStorage.setItem('leai:local:instructor-token', 'opaque-demo-token')
  renderSearchPage(false)
  expect(api.me).not.toHaveBeenCalled()
  expect(api.courses).not.toHaveBeenCalled()
  expect(screen.getByText(/backend identity/)).toBeInTheDocument()
})

it('lets the instructor retry loading courses after a transient error', async () => {
  sessionStorage.setItem('leai:local:instructor-token', 'opaque-demo-token')
  vi.mocked(api.courses).mockRejectedValueOnce(new Error('temporary outage'))
  const user = userEvent.setup()
  renderSearchPage()

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your courses')
  await user.click(screen.getByRole('button', { name: 'Retry loading courses' }))

  expect(await screen.findByRole('combobox', { name: 'Course' })).toHaveValue(courseId)
})
