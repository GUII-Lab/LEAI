import { expect, it, vi } from 'vitest'
import { getEnvironment } from '@/config/environment'
import { createSessionClient } from './browser-session'

const environment = getEnvironment({})
const json = (payload: unknown) => new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } })

it('uses a same-origin cookie and a freshly fetched CSRF token for each mutation', async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(json({ csrf_token: 'masked-csrf' }))
    .mockResolvedValueOnce(json({ expires_at: '2026-09-27T00:00:00Z', must_change_password: false }))
  const request = createSessionClient(environment, () => true, fetcher)
  await request('instructor_sessions/', { method: 'POST', body: JSON.stringify({ email: 'teacher@ucsc.edu', password: 'test' }) })
  expect(String(fetcher.mock.calls[0][0])).toContain('/instructor_csrf/')
  const [, init] = fetcher.mock.calls[1]
  expect(init?.credentials).toBe('same-origin')
  expect(new Headers(init?.headers).get('X-CSRFToken')).toBe('masked-csrf')
  expect(new Headers(init?.headers).has('Authorization')).toBe(false)
})

it('does not send credentials or a login body to a different origin', async () => {
  const fetcher = vi.fn<typeof fetch>()
  const request = createSessionClient({ ...environment, apiBaseUrl: 'https://other.example/datapipeline/api/v1/' }, () => true, fetcher)
  await expect(request('instructor_sessions/', { method: 'POST', body: 'private' })).rejects.toThrow(/same origin/i)
  expect(fetcher).not.toHaveBeenCalled()
})

it('does not bootstrap CSRF or mutate before environment verification', async () => {
  const fetcher = vi.fn<typeof fetch>()
  const request = createSessionClient(environment, () => false, fetcher)
  await expect(request('instructor_sessions/', { method: 'POST' })).rejects.toThrow(/read-only/i)
  expect(fetcher).not.toHaveBeenCalled()
})

it('fails closed if CSRF bootstrap fails', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }))
  const request = createSessionClient(environment, () => true, fetcher)
  await expect(request('instructor_sessions/', { method: 'DELETE' })).rejects.toThrow(/CSRF/)
  expect(fetcher).toHaveBeenCalledTimes(1)
})
