import { z } from 'zod'
import { environmentNameSchema, type ObservedEnvironment } from '@/config/environment'

const environmentResponseSchema = z.object({
  environment: environmentNameSchema,
  backend_build_sha: z.string().min(1),
  schema_identity: z.string().min(1),
  contract_version: z.string().min(1),
  allowed_app_bases: z.array(z.string().min(1)).min(1),
  server_time: z.string().datetime({ offset: true }),
})

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export async function fetchEnvironmentIdentity(
  apiBaseUrl: string,
  fetcher: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<ObservedEnvironment> {
  const endpoint = new URL('environment/', apiBaseUrl)
  const response = await fetcher(endpoint, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Environment handshake failed with HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  const parsed = environmentResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error('Invalid environment response')
  }

  return {
    environment: parsed.data.environment,
    backendBuildSha: parsed.data.backend_build_sha,
    schemaIdentity: parsed.data.schema_identity,
    contractVersion: parsed.data.contract_version,
    allowedAppBases: parsed.data.allowed_app_bases,
    serverTime: parsed.data.server_time,
  }
}
