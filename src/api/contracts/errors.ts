export type ApiFailureKind =
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'unavailable'
  | 'retryable_server'
  | 'network'
  | 'environment'
  | 'contract'

const apiFailureKinds = new Set<ApiFailureKind>([
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
])

const apiFailureKeys = new Set(['kind', 'status', 'code', 'requestId', 'retryable'])
const safeCodePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/i
const safeRequestIdPattern = /^(?:(?:req(?:uest)?|trace|correlation)[_-][a-z0-9_-]{1,96}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i
const credentialLikePrefix = /^(?:authorization|bearer|basic|token|secret|password|credential|sk|pk)(?:$|[ :_-])/i

function sanitizeCode(value: string | undefined): string | undefined {
  if (
    value === undefined ||
    value.length > 64 ||
    !safeCodePattern.test(value) ||
    credentialLikePrefix.test(value)
  ) {
    return undefined
  }

  return value
}

function sanitizeRequestId(value: string | undefined): string | undefined {
  if (
    value === undefined ||
    value.length > 128 ||
    !safeRequestIdPattern.test(value) ||
    credentialLikePrefix.test(value)
  ) {
    return undefined
  }

  return value
}

export class ApiFailure extends Error {
  readonly kind: ApiFailureKind
  readonly status: number | null
  readonly code?: string
  readonly requestId?: string
  readonly retryable: boolean

  constructor(options: {
    kind: ApiFailureKind
    status: number | null
    code?: string
    requestId?: string
    retryable: boolean
  }) {
    super('API request failed')
    this.kind = options.kind
    this.status = options.status
    this.code = sanitizeCode(options.code)
    this.requestId = sanitizeRequestId(options.requestId)
    this.retryable = options.retryable
  }
}

export function isApiFailure(value: unknown): value is ApiFailure {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  try {
    const candidate = value as Record<string, unknown>
    if (Object.keys(candidate).some((key) => !apiFailureKeys.has(key))) {
      return false
    }

    const status = candidate.status
    const code = candidate.code
    const requestId = candidate.requestId

    return (
      typeof candidate.kind === 'string' &&
      apiFailureKinds.has(candidate.kind as ApiFailureKind) &&
      (status === null ||
        (typeof status === 'number' && Number.isInteger(status) && status >= 0 && status <= 599)) &&
      (code === undefined || (typeof code === 'string' && sanitizeCode(code) === code)) &&
      (requestId === undefined ||
        (typeof requestId === 'string' && sanitizeRequestId(requestId) === requestId)) &&
      typeof candidate.retryable === 'boolean'
    )
  } catch {
    return false
  }
}
