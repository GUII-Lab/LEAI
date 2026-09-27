import { expect, it, vi } from 'vitest'
import { getEnvironment } from '@/config/environment'
import { createHttpClient, ReadOnlyEnvironmentError } from './http-client'

it('does not issue mutations before environment verification', async () => {
  const qaEnvironment = getEnvironment({
    VITE_LEAI_ENVIRONMENT: 'qa',
    VITE_LEAI_API_BASE_URL: 'https://leai-qa.invalid/datapipeline/api/v1/',
    VITE_LEAI_APP_BASE_PATH: '/LEAI/qa/',
    VITE_LEAI_BUILD_SHA: 'unbound-qa-build',
    VITE_LEAI_BACKEND_BUILD_SHA: 'qa-backend-placeholder',
    VITE_LEAI_SCHEMA_IDENTITY: 'qa-schema-placeholder',
    VITE_LEAI_CONTRACT_VERSION: '2026-09-17',
  })
  const fetcher = vi.fn()
  const request = createHttpClient(qaEnvironment, () => false, fetcher)

  await expect(request('drafts/', { method: 'POST' })).rejects.toBeInstanceOf(
    ReadOnlyEnvironmentError,
  )
  expect(fetcher).not.toHaveBeenCalled()
})

it('uses a bearer capability without ambient browser credentials', async () => {
  const environment = getEnvironment({})
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
  const request = createHttpClient(environment, () => true, fetcher, () => 'opaque-token')

  await request('instructor_me/')
  const [, init] = fetcher.mock.calls[0]
  expect(init?.credentials).toBe('omit')
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer opaque-token')
})
