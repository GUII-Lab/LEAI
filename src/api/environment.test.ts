import { expect, it, vi } from 'vitest'
import { fetchEnvironmentIdentity } from './environment'

it('validates the public environment handshake response', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        environment: 'qa',
        backend_build_sha: 'qa-backend-placeholder',
        schema_identity: 'qa-schema-placeholder',
        contract_version: '2026-09-17',
        allowed_app_bases: ['/LEAI/qa/'],
        server_time: '2026-09-17T20:00:00Z',
      }),
      { status: 200 },
    ),
  )

  await expect(fetchEnvironmentIdentity('https://leai-qa.invalid/api/', fetcher)).resolves.toMatchObject({
    environment: 'qa',
    contractVersion: '2026-09-17',
  })
})

it('rejects malformed environment responses', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ environment: 'qa' }), { status: 200 }),
  )

  await expect(fetchEnvironmentIdentity('https://leai-qa.invalid/api/', fetcher)).rejects.toThrow(
    'Invalid environment response',
  )
})

it('does not send browser credentials with the public cross-origin handshake', async () => {
  const fetcher = async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.credentials !== 'omit') {
      throw new Error('Public handshake would send browser credentials')
    }
    return new Response(JSON.stringify({
      environment: 'local',
      backend_build_sha: 'local-backend',
      schema_identity: 'public',
      contract_version: '2026-09-21',
      allowed_app_bases: ['/'],
      server_time: '2026-09-22T21:48:42+00:00',
    }), { status: 200 })
  }

  await expect(fetchEnvironmentIdentity('http://127.0.0.1:8000/datapipeline/api/v1/', fetcher))
    .resolves.toMatchObject({ environment: 'local', schemaIdentity: 'public' })
})
