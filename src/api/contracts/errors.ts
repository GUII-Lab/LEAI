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
const apiFailureInstanceKeys = new Set([...apiFailureKeys, 'message', 'stack'])
const safeCodes = new Set(['request_failed'])
const safeRequestIdPattern = /^req_[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const credentialTermPattern = /authorization|bearer|basic|token|secret|password|credential|aws|jwt/i
const apiFailureMessage = 'API request failed'
const apiFailureInstances = new WeakSet<object>()

function sanitizeCode(value: string | undefined): string | undefined {
  return value !== undefined && safeCodes.has(value) ? value : undefined
}

function sanitizeRequestId(value: string | undefined): string | undefined {
  if (
    value === undefined ||
    !safeRequestIdPattern.test(value) ||
    credentialTermPattern.test(value)
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
    super(apiFailureMessage)
    this.kind = options.kind
    this.status = options.status
    this.code = sanitizeCode(options.code)
    this.requestId = sanitizeRequestId(options.requestId)
    this.retryable = options.retryable
    const safeStack = this.stack ?? `ApiFailure: ${apiFailureMessage}`
    Object.defineProperty(this, 'stack', {
      value: safeStack,
      writable: false,
      enumerable: false,
      configurable: false,
    })
    apiFailureInstances.add(this)
    Object.freeze(this)
  }
}

function isDataProperty(descriptor: PropertyDescriptor | undefined): descriptor is PropertyDescriptor & {
  value: unknown
} {
  return descriptor !== undefined && 'value' in descriptor
}

function hasValidFailureFields(descriptors: PropertyDescriptorMap): boolean {
  const kind = descriptors.kind
  const status = descriptors.status
  const retryable = descriptors.retryable
  const code = descriptors.code
  const requestId = descriptors.requestId

  if (
    !isDataProperty(kind) ||
    !kind.enumerable ||
    !isDataProperty(status) ||
    !status.enumerable ||
    !isDataProperty(retryable) ||
    !retryable.enumerable
  ) {
    return false
  }
  if (code !== undefined && (!isDataProperty(code) || !code.enumerable)) {
    return false
  }
  if (requestId !== undefined && (!isDataProperty(requestId) || !requestId.enumerable)) {
    return false
  }

  return (
    typeof kind.value === 'string' &&
    apiFailureKinds.has(kind.value as ApiFailureKind) &&
    (status.value === null ||
      (typeof status.value === 'number' &&
        Number.isInteger(status.value) &&
        status.value >= 0 &&
        status.value <= 599)) &&
    (code?.value === undefined ||
      (typeof code.value === 'string' && sanitizeCode(code.value) === code.value)) &&
    (requestId?.value === undefined ||
      (typeof requestId.value === 'string' &&
        sanitizeRequestId(requestId.value) === requestId.value)) &&
    typeof retryable.value === 'boolean'
  )
}

export function isApiFailure(value: unknown): value is ApiFailure {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  try {
    const ownKeys = Reflect.ownKeys(value)
    const descriptors = Object.getOwnPropertyDescriptors(value)

    if (apiFailureInstances.has(value)) {
      if (
        Object.getPrototypeOf(value) !== ApiFailure.prototype ||
        !Object.isFrozen(value) ||
        ownKeys.some((key) => typeof key !== 'string' || !apiFailureInstanceKeys.has(key)) ||
        !isDataProperty(descriptors.message) ||
        descriptors.message.enumerable ||
        descriptors.message.value !== apiFailureMessage ||
        (descriptors.stack !== undefined &&
          (!isDataProperty(descriptors.stack) ||
            descriptors.stack.enumerable ||
            typeof descriptors.stack.value !== 'string')) ||
        descriptors.cause !== undefined
      ) {
        return false
      }

      return hasValidFailureFields(descriptors)
    }

    if (value instanceof ApiFailure) {
      return false
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      return false
    }
    if (ownKeys.some((key) => typeof key !== 'string' || !apiFailureKeys.has(key))) {
      return false
    }

    return hasValidFailureFields(descriptors)
  } catch {
    return false
  }
}
