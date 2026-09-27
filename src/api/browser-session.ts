import { z } from 'zod'
import type { PublicEnvironment } from '@/config/environment'
import { ReadOnlyEnvironmentError } from './http-client'

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const csrfResponse = z.object({ csrf_token: z.string().min(1) }).strict()

export function createSessionClient(
  environment: PublicEnvironment,
  canMutate: () => boolean,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
) {
  return async function request(path: string, init: RequestInit = {}) {
    const base = new URL(environment.apiBaseUrl, window.location.origin)
    const url = new URL(path, base)
    if (url.origin !== window.location.origin || !url.pathname.startsWith(base.pathname)) {
      throw new Error('Instructor requests must use the same origin and API namespace as this page.')
    }
    const method = (init.method ?? 'GET').toUpperCase()
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    headers.delete('Authorization')
    if (unsafeMethods.has(method)) {
      if (!canMutate()) throw new ReadOnlyEnvironmentError()
      // Fetch per mutation so password/login rotation in another tab cannot leave
      // a cached CSRF token stale. This endpoint never returns the session secret.
      const response = await fetcher(new URL('instructor_csrf/', base), {
        credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: init.signal,
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error('CSRF verification is unavailable. Please try again.')
      headers.set('X-CSRFToken', csrfResponse.parse(await response.json()).csrf_token)
    }
    return fetcher(url, { ...init, method, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
  }
}
