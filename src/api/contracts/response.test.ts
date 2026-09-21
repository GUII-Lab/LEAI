import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { isApiFailure, type ApiFailure, type ApiFailureKind } from './errors'
import { parseJsonResponse } from './response'

async function captureFailure(result: Promise<unknown>): Promise<ApiFailure> {
  try {
    await result
  } catch (error) {
    expect(isApiFailure(error)).toBe(true)
    return error as ApiFailure
  }

  throw new Error('Expected an ApiFailure')
}

describe('parseJsonResponse', () => {
  it('returns the supplied schema output for a successful valid response', async () => {
    const schema = z.object({
      count: z.string().transform((value) => Number(value)),
    })

    const result = await parseJsonResponse(
      new Response(JSON.stringify({ count: '7' }), { status: 200 }),
      schema,
    )

    expect(result).toEqual({ count: 7 })
  })

  it.each([
    { status: 401, kind: 'authentication', retryable: false },
    { status: 403, kind: 'authorization', retryable: false },
    { status: 404, kind: 'not_found', retryable: false },
    { status: 409, kind: 'conflict', retryable: false },
    { status: 422, kind: 'validation', retryable: false },
    { status: 429, kind: 'unavailable', retryable: true },
    { status: 500, kind: 'retryable_server', retryable: true },
    { status: 599, kind: 'retryable_server', retryable: true },
  ] satisfies ReadonlyArray<{
    status: number
    kind: ApiFailureKind
    retryable: boolean
  }>)('normalizes HTTP $status as $kind', async ({ status, kind, retryable }) => {
    const failure = await captureFailure(
      parseJsonResponse(
        new Response(
          JSON.stringify({
            error: 'authorization',
            code: 'request_failed',
            message: 'student transcript text must remain private',
            request_id: 'req_contract_123',
            retryable: !retryable,
          }),
          { status },
        ),
        z.object({ ok: z.literal(true) }),
      ),
    )

    expect(failure).toMatchObject({
      kind,
      status,
      code: 'request_failed',
      requestId: 'req_contract_123',
      retryable,
    })
    expect(failure.message).toBe('API request failed')
  })

  it('normalizes malformed JSON in a successful response as a contract failure', async () => {
    const failure = await captureFailure(
      parseJsonResponse(
        new Response('{"transcript":"private student text"', { status: 200 }),
        z.object({ ok: z.literal(true) }),
      ),
    )

    expect(failure).toMatchObject({ kind: 'contract', status: 200, retryable: false })
    expect(failure.message).toBe('API request failed')
  })

  it('normalizes a schema-invalid successful response as a contract failure', async () => {
    const failure = await captureFailure(
      parseJsonResponse(
        new Response(
          JSON.stringify({
            ok: false,
            transcript: 'private student response',
            authorization: 'Bearer private-token',
          }),
          { status: 200 },
        ),
        z.object({ ok: z.literal(true) }),
      ),
    )

    expect(failure).toMatchObject({ kind: 'contract', status: 200, retryable: false })
  })

  it('does not retain raw body, transcript, backend message, or authorization-like values', async () => {
    const privateValues = [
      'student said this in a private transcript',
      'Bearer private-token',
      'Basic private-credential',
    ]
    const failure = await captureFailure(
      parseJsonResponse(
        new Response(
          JSON.stringify({
            error: privateValues[1],
            code: privateValues[1],
            message: privateValues[0],
            request_id: privateValues[2],
            retryable: true,
            raw_body: privateValues.join(' '),
          }),
          { status: 422 },
        ),
        z.object({ ok: z.literal(true) }),
      ),
    )

    const diagnostic = [
      String(failure),
      failure.message,
      failure.stack ?? '',
      JSON.stringify(failure),
      ...Object.getOwnPropertyNames(failure).map((key) => String(Reflect.get(failure, key))),
    ].join('\n')

    for (const privateValue of privateValues) {
      expect(diagnostic).not.toContain(privateValue)
    }
    expect(failure.code).toBeUndefined()
    expect(failure.requestId).toBeUndefined()
    expect('cause' in failure).toBe(false)
    expect(Object.keys(failure).sort()).toEqual([
      'code',
      'kind',
      'requestId',
      'retryable',
      'status',
    ])
  })
})
