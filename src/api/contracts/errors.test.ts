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
      requestId: 'req_550e8400-e29b-41d4-a716-446655440000',
      retryable: kind === 'network' || kind === 'retryable_server',
    })

    expect(failure).toMatchObject({
      kind,
      status: kind === 'network' ? null : 500,
      code: 'request_failed',
      requestId: 'req_550e8400-e29b-41d4-a716-446655440000',
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

  it('drops unknown and token-shaped diagnostic values instead of serializing them', () => {
    const unsafeValues = [
      {
        code: 'student_secret',
        requestId: 'req_bearer_private-token',
      },
      {
        code: 'AKIAIOSFODNN7EXAMPLE',
        requestId: 'req_AKIAIOSFODNN7EXAMPLE',
      },
      {
        code: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature',
        requestId: 'req_eyJhbGciOiJIUzI1NiJ9',
      },
      {
        code: 'student_secret_2',
        requestId: 'req_0123456789abcdef',
      },
    ]

    for (const unsafe of unsafeValues) {
      const failure = new ApiFailure({
        kind: 'validation',
        status: 422,
        code: unsafe.code,
        requestId: unsafe.requestId,
        retryable: false,
      })
      const serialized = JSON.stringify(failure)

      expect(failure.code).toBeUndefined()
      expect(failure.requestId).toBeUndefined()
      expect(serialized).not.toContain(unsafe.code)
      expect(serialized).not.toContain(unsafe.requestId)
    }
  })

  it('rejects inherited failure fields and non-enumerable private carriers', () => {
    const inherited = Object.create({
      kind: 'network',
      status: null,
      retryable: true,
    })
    const serializedWithPrivateMessage = {
      kind: 'network',
      status: null,
      retryable: true,
    }
    Object.defineProperty(serializedWithPrivateMessage, 'message', {
      value: 'private transcript',
      enumerable: false,
    })
    const nonEnumerableKind = {
      status: null,
      retryable: true,
    }
    Object.defineProperty(nonEnumerableKind, 'kind', {
      value: 'network',
      enumerable: false,
    })

    expect(isApiFailure(inherited)).toBe(false)
    expect(isApiFailure(serializedWithPrivateMessage)).toBe(false)
    expect(isApiFailure(nonEnumerableKind)).toBe(false)
  })

  it('rejects foreign Error instances carrying failure-like fields', () => {
    const foreign = new Error('private transcript', {
      cause: 'Bearer private-token',
    }) as Error & {
      kind: string
      status: null
      retryable: boolean
    }
    foreign.kind = 'network'
    foreign.status = null
    foreign.retryable = true

    expect(isApiFailure(foreign)).toBe(false)
  })

  it('rejects accessor shapes and returns false for throwing proxies', () => {
    const accessorShape = {
      status: null,
      retryable: true,
    }
    Object.defineProperty(accessorShape, 'kind', {
      get: () => 'network',
      enumerable: true,
    })
    const throwingProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('private proxy trap')
        },
      },
    )

    expect(isApiFailure(accessorShape)).toBe(false)
    expect(isApiFailure(throwingProxy)).toBe(false)
  })

  it('freezes constructed failures so their diagnostic stack cannot be replaced', () => {
    const failure = new ApiFailure({
      kind: 'network',
      status: null,
      retryable: true,
    })

    expect(Object.isFrozen(failure)).toBe(true)
    expect(() => Object.defineProperty(failure, 'stack', {
      value: 'private transcript',
    })).toThrow()
    expect(isApiFailure(failure)).toBe(true)
  })

  it('rejects subclasses, forged prototypes, and transparent proxies', () => {
    class ForeignFailure extends ApiFailure {}
    const subclass = new ForeignFailure({
      kind: 'network', status: null, retryable: true,
    })
    const genuine = new ApiFailure({
      kind: 'network', status: null, retryable: true,
    })
    const forged = Object.create(ApiFailure.prototype)
    Object.assign(forged, {
      kind: 'network', status: null, retryable: true,
      message: 'API request failed', stack: genuine.stack,
    })

    expect(isApiFailure(subclass)).toBe(false)
    expect(isApiFailure(forged)).toBe(false)
    expect(isApiFailure(new Proxy(genuine, {}))).toBe(false)
  })
})
