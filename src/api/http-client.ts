import type { PublicEnvironment } from '@/config/environment'

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export class ReadOnlyEnvironmentError extends Error {
  constructor() {
    super('This environment is read-only until its backend identity is verified.')
  }
}

export function createHttpClient(
  environment: PublicEnvironment,
  canMutate: () => boolean,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  getToken: () => string | null = () => null,
) {
  return async function request(path: string, init: RequestInit = {}) {
    const method = (init.method ?? 'GET').toUpperCase()
    if (mutationMethods.has(method) && !canMutate()) {
      throw new ReadOnlyEnvironmentError()
    }

    const url = new URL(path.replace(/^\/+/, ''), new URL(environment.apiBaseUrl, window.location.origin))
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetcher(url, {
      ...init,
      method,
      credentials: 'omit',
      headers,
    })
  }
}
