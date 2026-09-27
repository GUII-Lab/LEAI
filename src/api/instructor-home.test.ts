import { expect, it, vi } from 'vitest'
import { getEnvironment } from '@/config/environment'
import { createInstructorApi } from './instructor-v1'
import { canonicalInstructorMeSchema } from './contracts/instructor'

const environment = getEnvironment({})
const account = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'teacher@ucsc.edu', display_name: 'Teacher',
  must_change_password: false, platform_role: 'member',
  institutions: [{ slug: 'ucsc', name: 'UC Santa Cruz', can_create_courses: true }],
}
const course = {
  course_id: '11111111-1111-4111-8111-111111111111', course_code: 'cmpm-80h',
  course_name: 'Game Design', institution_slug: 'ucsc', lifecycle_state: 'active',
  role: 'owner', allowed_actions: ['course.manage', 'feedback.author', 'feedback.publish',
    'responses.view', 'responses.export', 'analysis.use'],
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
})

it('parses an instructor account with server-issued institutional creation permissions', () => {
  expect(canonicalInstructorMeSchema.parse(account).institutions).toEqual(account.institutions)
  expect(canonicalInstructorMeSchema.safeParse({ ...account, institutions: [{ ...account.institutions[0], can_create_courses: 'yes' }] }).success).toBe(false)
})

it('creates a course through the same-origin CSRF session client', async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(json({ csrf_token: 'masked-csrf-token' }))
    .mockResolvedValueOnce(json(course, 201))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.createCourse({ institution_slug: 'ucsc', course_code: 'cmpm-80h', course_name: 'Game Design' }))
    .resolves.toMatchObject({ course_code: 'cmpm-80h', role: 'owner' })
  const [url, init] = fetcher.mock.calls[1]
  expect(String(url)).toMatch(/instructor_courses\/$/)
  expect(init?.method).toBe('POST')
  expect(init?.credentials).toBe('same-origin')
  expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('masked-csrf-token')
  expect(new Headers(init?.headers).get('Authorization')).toBeNull()
  expect(init?.body).toBe(JSON.stringify({ institution_slug: 'ucsc', course_code: 'cmpm-80h', course_name: 'Game Design' }))
})

it('updates only the display name and refuses to send a profile email', async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(json({ csrf_token: 'masked-csrf-token' }))
    .mockResolvedValueOnce(json({ ...account, display_name: 'Updated Teacher' }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.updateProfile('Updated Teacher')).resolves.toMatchObject({ display_name: 'Updated Teacher' })
  const [url, init] = fetcher.mock.calls[1]
  expect(String(url)).toMatch(/instructor_me\/$/)
  expect(init?.method).toBe('PATCH')
  expect(init?.body).toBe(JSON.stringify({ display_name: 'Updated Teacher' }))
  expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('masked-csrf-token')
})
