import { z } from 'zod'
import { ApiFailure, type ApiFailureKind } from './errors'

const safeErrorEnvelopeSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  request_id: z.string().optional(),
  retryable: z.boolean().optional(),
})

type SafeErrorEnvelope = z.infer<typeof safeErrorEnvelopeSchema>

function normalizeHttpFailure(
  status: number,
  retryableHint: boolean | undefined,
): { kind: ApiFailureKind; retryable: boolean } {
  switch (status) {
    case 401:
      return { kind: 'authentication', retryable: false }
    case 403:
      return { kind: 'authorization', retryable: false }
    case 404:
      return { kind: 'not_found', retryable: false }
    case 409:
      return { kind: 'conflict', retryable: false }
    case 422:
      return { kind: 'validation', retryable: false }
    case 429:
      return { kind: 'unavailable', retryable: true }
    default:
      if (status >= 500 && status <= 599) {
        return { kind: 'retryable_server', retryable: true }
      }
      return { kind: 'contract', retryable: retryableHint === true }
  }
}

async function readSafeErrorEnvelope(response: Response): Promise<SafeErrorEnvelope> {
  try {
    const payload: unknown = await response.json()
    const parsed = safeErrorEnvelopeSchema.safeParse(payload)
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

function contractFailure(status: number): ApiFailure {
  return new ApiFailure({
    kind: 'contract',
    status,
    retryable: false,
  })
}

export async function parseJsonResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!response.ok) {
    const envelope = await readSafeErrorEnvelope(response)
    const normalized = normalizeHttpFailure(response.status, envelope.retryable)

    throw new ApiFailure({
      ...normalized,
      status: response.status,
      code: response.status === 404 ? undefined : (envelope.code ?? envelope.error),
      requestId: envelope.request_id,
    })
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw contractFailure(response.status)
  }

  try {
    const parsed = schema.safeParse(payload)
    if (parsed.success) {
      return parsed.data
    }
  } catch {
    throw contractFailure(response.status)
  }

  throw contractFailure(response.status)
}
