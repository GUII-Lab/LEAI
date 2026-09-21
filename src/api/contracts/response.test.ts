import { describe, expect, expectTypeOf, it } from 'vitest'
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
    expectTypeOf(result).toEqualTypeOf<{ count: number }>()
  })

  it.each([
    { status: 401, kind: 'authentication', retryable: false, code: 'request_failed' },
    { status: 403, kind: 'authorization', retryable: false, code: 'request_failed' },
    { status: 404, kind: 'not_found', retryable: false, code: undefined },
    { status: 409, kind: 'conflict', retryable: false, code: 'request_failed' },
    { status: 422, kind: 'validation', retryable: false, code: 'request_failed' },
    { status: 429, kind: 'unavailable', retryable: true, code: 'request_failed' },
    { status: 500, kind: 'retryable_server', retryable: true, code: 'request_failed' },
    { status: 599, kind: 'retryable_server', retryable: true, code: 'request_failed' },
  ] satisfies ReadonlyArray<{
    status: number
    kind: ApiFailureKind
    retryable: boolean
    code: string | undefined
  }>)('normalizes HTTP $status as $kind', async ({ status, kind, retryable, code }) => {
    const failure = await captureFailure(
      parseJsonResponse(
        new Response(
          JSON.stringify({
            error: 'authorization',
            code: 'request_failed',
            message: 'student transcript text must remain private',
            request_id: 'req_550e8400-e29b-41d4-a716-446655440000',
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
      code,
      requestId: 'req_550e8400-e29b-41d4-a716-446655440000',
      retryable,
    })
    expect(failure.message).toBe('API request failed')
  })

  it('does not disclose a 404 body classification through code or error', async () => {
    const failure = await captureFailure(
      parseJsonResponse(
        new Response(
          JSON.stringify({
            error: 'authorization',
            code: 'request_failed',
            message: 'the resource exists but is forbidden',
            request_id: 'req_550e8400-e29b-41d4-a716-446655440000',
          }),
          { status: 404 },
        ),
        z.object({ ok: z.literal(true) }),
      ),
    )

    expect(failure).toMatchObject({
      kind: 'not_found',
      status: 404,
      code: undefined,
      requestId: 'req_550e8400-e29b-41d4-a716-446655440000',
      retryable: false,
    })
    expect(JSON.stringify(failure)).not.toContain('authorization')
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
