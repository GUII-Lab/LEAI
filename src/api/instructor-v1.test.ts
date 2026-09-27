import { expect, it, vi } from 'vitest'
import { getEnvironment } from '@/config/environment'
import { AuthenticationRequiredError, createInstructorApi } from './instructor-v1'

const environment = getEnvironment({})
const courseId = '11111111-1111-4111-8111-111111111111'
const csrf = () => new Response(JSON.stringify({ csrf_token: 'masked-csrf-token' }))

it('sends course search with same-origin cookies and a fresh CSRF token', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(csrf()).mockResolvedValueOnce(new Response(JSON.stringify({
    query: 'capstone', results: [], has_more: false,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.search(courseId, 'capstone')).resolves.toMatchObject({ query: 'capstone' })
  const [url, init] = fetcher.mock.calls[1]
  expect(String(url)).toMatch(new RegExp(`instructor_courses/${courseId}/responses/search/$`))
  expect(init?.method).toBe('POST')
  expect(init?.body).toBe(JSON.stringify({ query: 'capstone' }))
  expect(String(url)).not.toContain('capstone')
  expect(init?.credentials).toBe('same-origin')
  expect(new Headers(init?.headers).get('Authorization')).toBeNull()
  expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('masked-csrf-token')
})

it('keeps the login request unauthenticated and rejects invalid wire data', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(csrf()).mockResolvedValueOnce(new Response(JSON.stringify({
    expires_at: '2026-09-22T12:30:45+00:00', must_change_password: false,
  }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await api.login('teacher@ucsc.edu', 'test-password')
  const [, init] = fetcher.mock.calls[1]
  expect(new Headers(init?.headers).get('Authorization')).toBeNull()
  expect(init?.credentials).toBe('same-origin')
})

it('classifies a 401 separately from 403 and does not expose a raw response', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
    error: 'authentication_required',
  }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.courses()).rejects.toBeInstanceOf(AuthenticationRequiredError)
})

it('passes a cancellation signal through the protected course request', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ courses: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))
  const api = createInstructorApi(environment, () => true, fetcher)
  const controller = new AbortController()

  await api.courses(controller.signal)

  expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
})

it('reads and updates the persisted Researcher-only debug setting with optimistic versioning', async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify({ debug_enabled: false, settings_version: 1 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    .mockResolvedValueOnce(csrf())
    .mockResolvedValueOnce(new Response(JSON.stringify({ debug_enabled: true, settings_version: 2 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.debugSettings(courseId)).resolves.toEqual({ debug_enabled: false, settings_version: 1 })
  await expect(api.updateDebugSettings(courseId, true, 1)).resolves.toEqual({ debug_enabled: true, settings_version: 2 })
  expect(String(fetcher.mock.calls[0]?.[0])).toMatch(new RegExp(`instructor_courses/${courseId}/debug-settings/$`))
  expect(fetcher.mock.calls[0]?.[1]?.method ?? 'GET').toBe('GET')
  expect(fetcher.mock.calls[2]?.[1]?.method).toBe('PATCH')
  expect(JSON.parse(fetcher.mock.calls[2]?.[1]?.body as string)).toEqual({ debug_enabled: true, expected_settings_version: 1 })
  expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get('X-CSRFToken')).toBe('masked-csrf-token')
})

it('changes a password through a CSRF-protected PATCH without exposing a session token', async () => {
  const rotated = {
    expires_at: '2026-09-24T13:00:00Z', must_change_password: false,
  }
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(csrf()).mockResolvedValueOnce(new Response(JSON.stringify(rotated), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.changePassword('old-password', 'new-password')).resolves.toEqual(rotated)
  const [url, init] = fetcher.mock.calls[1]
  expect(String(url)).toMatch(/instructor_password\/$/)
  expect(init?.method).toBe('PATCH')
  expect(init?.credentials).toBe('same-origin')
  expect(new Headers(init?.headers).get('Authorization')).toBeNull()
  expect(init?.body).toBe(JSON.stringify({ current_password: 'old-password', new_password: 'new-password' }))
})
