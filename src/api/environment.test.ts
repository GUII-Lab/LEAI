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
