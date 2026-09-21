import { describe, expect, it } from 'vitest'
import { ApiFailure, isApiFailure, type ApiFailureKind } from './errors'

const failureKinds = [
  'authentication',
  'authorization',
  'not_found',
  'conflict',
  'validation',
  'unavailable',
  'retryable_server',
  'network',
  'environment',
  'contract',
] as const satisfies readonly ApiFailureKind[]

describe('ApiFailure', () => {
  it.each(failureKinds)('preserves the %s discriminant as a privacy-safe shape', (kind) => {
    const failure = new ApiFailure({
      kind,
      status: kind === 'network' ? null : 500,
      code: 'request_failed',
      requestId: 'req_contract_123',
      retryable: kind === 'network' || kind === 'retryable_server',
    })

    expect(failure).toMatchObject({
      kind,
      status: kind === 'network' ? null : 500,
      code: 'request_failed',
      requestId: 'req_contract_123',
      retryable: kind === 'network' || kind === 'retryable_server',
    })
    expect(isApiFailure(failure)).toBe(true)
  })

  it('recognizes only a structurally valid serialized failure', () => {
    expect(
      isApiFailure({
        kind: 'network',
        status: null,
        code: undefined,
        requestId: undefined,
        retryable: true,
      }),
    ).toBe(true)

    expect(
      isApiFailure({
        kind: 'network',
        status: null,
        retryable: true,
        rawBody: 'private transcript',
      }),
    ).toBe(false)
    expect(isApiFailure({ kind: 'network', status: 'none', retryable: true })).toBe(false)
    expect(isApiFailure({ kind: 'unknown', status: null, retryable: true })).toBe(false)
  })

  it('drops authorization-like values supplied as diagnostic identifiers', () => {
    const failure = new ApiFailure({
      kind: 'validation',
      status: 422,
      code: 'Bearer private-token',
      requestId: 'Authorization: Basic private-token',
      retryable: false,
    })

    expect(failure.code).toBeUndefined()
    expect(failure.requestId).toBeUndefined()
    expect(Object.keys(failure).sort()).toEqual([
      'code',
      'kind',
      'requestId',
      'retryable',
      'status',
    ])
  })
})
