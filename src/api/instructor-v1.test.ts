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


it('creates an asynchronous Feedback Chat turn with CSRF and the caller idempotency key', async () => {
  const chatId = '22222222-2222-4222-8222-222222222222'
  const jobId = '33333333-3333-4333-8333-333333333333'
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(csrf())
    .mockResolvedValueOnce(new Response(JSON.stringify({ job_id: jobId }), { status: 202 }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.createTurn(courseId, chatId, { content: 'What changed?' }, 'turn-attempt-1'))
    .resolves.toEqual({ job_id: jobId })
  const [url, init] = fetcher.mock.calls[1]
  expect(String(url)).toContain(`instructor_courses/${courseId}/analysis/chats/${chatId}/turns/`)
  expect(init?.method).toBe('POST')
  expect(JSON.parse(init?.body as string)).toEqual({ content: 'What changed?' })
  expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('turn-attempt-1')
  expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('masked-csrf-token')
})

it('uses the versioned course setting endpoint for anonymous matching', async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify({ anonymous_matching_enabled: false, settings_version: 7 }), { status: 200 }))
    .mockResolvedValueOnce(csrf())
    .mockResolvedValueOnce(new Response(JSON.stringify({ anonymous_matching_enabled: true, settings_version: 8 }), { status: 200 }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.settings(courseId)).resolves.toEqual({ anonymous_matching_enabled: false, settings_version: 7 })
  await expect(api.updateSettings(courseId, { anonymous_matching_enabled: true, expected_settings_version: 7 }))
    .resolves.toEqual({ anonymous_matching_enabled: true, settings_version: 8 })
  expect(String(fetcher.mock.calls[0]?.[0])).toContain(`instructor_courses/${courseId}/analysis-settings/`)
  expect(fetcher.mock.calls[2]?.[1]?.method).toBe('PATCH')
  expect(JSON.parse(fetcher.mock.calls[2]?.[1]?.body as string)).toEqual({
    anonymous_matching_enabled: true, expected_settings_version: 7,
  })
  expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get('X-CSRFToken')).toBe('masked-csrf-token')
})

it('treats archived Feedback Chat 204 responses as success', async () => {
  const chatId = '22222222-2222-4222-8222-222222222222'
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(csrf()).mockResolvedValueOnce(new Response(null, { status: 204 }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.archiveChat(courseId, chatId)).resolves.toBeUndefined()
  expect(String(fetcher.mock.calls[1]?.[0])).toContain(`instructor_courses/${courseId}/analysis/chats/${chatId}/`)
  expect(fetcher.mock.calls[1]?.[1]?.method).toBe('DELETE')
})

it('requests occurrence-scoped n-grams and adds phrase search to Analyzer response pages', async () => {
  const occurrenceId = '22222222-2222-4222-8222-222222222223'
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify({ source_count: 2, cutoff_at: null, keyness_available: false, items: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], has_more: false, next_cursor: null }), { status: 200 }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.ngrams(courseId, [occurrenceId], 2)).resolves.toMatchObject({ source_count: 2 })
  await api.responses(courseId, { occurrenceIds: [occurrenceId], limit: 25, source: 'all', nudgedOnly: false, term: 'clear steps' })

  expect(String(fetcher.mock.calls[0]?.[0])).toContain(`instructor_courses/${courseId}/analysis/ngrams/?size=2&occurrence_ids=${occurrenceId}`)
  expect(String(fetcher.mock.calls[1]?.[0])).toContain(`instructor_courses/${courseId}/analysis/responses/?`)
  expect(new URL(String(fetcher.mock.calls[1]?.[0])).searchParams.get('term')).toBe('clear steps')
})

it('loads one course-scoped Analyzer response by its public response ID', async () => {
  const responseId = '22222222-2222-4222-8222-222222222224'
  const response = {
    kind: 'chat',
    response_id: responseId,
    label: 'R4',
    survey_label: 'Week 1 feedback',
    created_at: '2026-09-27T12:20:00Z',
    nudged: false,
    response_href: '#response=' + responseId,
    transcript: [{ message_id: '57', content: 'The instructions were clear.', timestamp: '2026-09-27T12:20:00Z' }],
    answers: [],
    occurrence_id: '22222222-2222-4222-8222-222222222225',
    team_snapshot_id: null,
    team_snapshot_item_id: null,
    team_label: null,
    team_configuration_label: null,
    source: 'student',
  }
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.responseDetail(courseId, responseId)).resolves.toMatchObject({ response_id: responseId })
  expect(String(fetcher.mock.calls[0]?.[0])).toContain(`instructor_courses/${courseId}/analysis/responses/${responseId}/`)
})

it('verifies certificate codes in one bounded course-scoped request without echoing code values', async () => {
  const occurrenceId = '22222222-2222-4222-8222-222222222226'
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(csrf())
    .mockResolvedValueOnce(new Response(JSON.stringify({ results: [true, false] }), { status: 200 }))
  const api = createInstructorApi(environment, () => true, fetcher)

  await expect(api.verifyCertificates(courseId, {
    occurrence_id: occurrenceId,
    codes: ['ABCD-EFGH-JKLM-NPQR', 'WXYZ-WXYZ-WXYZ-WXYZ'],
  })).resolves.toEqual({ results: [true, false] })
  const [url, init] = fetcher.mock.calls[1]
  expect(String(url)).toContain(`instructor_courses/${courseId}/analysis/certificates/verify/`)
  expect(init?.method).toBe('POST')
  expect(JSON.parse(init?.body as string)).toEqual({ occurrence_id: occurrenceId, codes: ['ABCD-EFGH-JKLM-NPQR', 'WXYZ-WXYZ-WXYZ-WXYZ'] })
  expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('masked-csrf-token')
})
