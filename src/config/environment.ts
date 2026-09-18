import { z } from 'zod'

export const environmentNameSchema = z.enum(['local', 'qa', 'production'])
export type EnvironmentName = z.infer<typeof environmentNameSchema>

export type BackendExpectation = {
  buildSha: string
  schemaIdentity: string
  contractVersion: string
}

export type PublicEnvironment = {
  name: EnvironmentName
  apiBaseUrl: string
  appBasePath: string
  storagePrefix: string
  buildSha: string
  environmentLabel: string
}

export type EnvironmentManifest = PublicEnvironment & {
  expectedBackend: BackendExpectation
}

export type ObservedEnvironment = {
  environment: EnvironmentName
  backendBuildSha: string
  schemaIdentity: string
  contractVersion: string
  allowedAppBases: string[]
  serverTime: string
}

export type EnvironmentVerification = { ok: true } | { ok: false; reason: string }

type EnvironmentSource = Record<string, unknown>

const allowedPublicVariables = new Set([
  'VITE_LEAI_ENVIRONMENT',
  'VITE_LEAI_API_BASE_URL',
  'VITE_LEAI_APP_BASE_PATH',
  'VITE_LEAI_BUILD_SHA',
  'VITE_LEAI_BACKEND_BUILD_SHA',
  'VITE_LEAI_SCHEMA_IDENTITY',
  'VITE_LEAI_CONTRACT_VERSION',
])

const localEnvironment: EnvironmentManifest = {
  name: 'local',
  apiBaseUrl: 'http://127.0.0.1:8000/api/',
  appBasePath: '/',
  storagePrefix: 'leai:local',
  buildSha: 'local-development',
  environmentLabel: 'Local development',
  expectedBackend: {
    buildSha: 'local-backend',
    schemaIdentity: 'local-schema',
    contractVersion: '2026-09-17',
  },
}

function optionalString(source: EnvironmentSource, key: string) {
  const value = source[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function requiredPublicValue(source: EnvironmentSource, key: string) {
  const value = optionalString(source, key)
  if (!value) {
    throw new Error(`Missing required public environment variable ${key}`)
  }
  return value
}

function assertPublicVariablesAreSafe(source: EnvironmentSource) {
  for (const key of Object.keys(source)) {
    if (!key.startsWith('VITE_')) continue

    if (/(secret|token|password|private|api[_-]?key|credential)/i.test(key)) {
      throw new Error(`Client environment variable ${key} appears to contain a secret`)
    }

    if (key.startsWith('VITE_LEAI_') && !allowedPublicVariables.has(key)) {
      throw new Error(`Unknown LEAI client environment variable ${key}`)
    }
  }
}

function assertManifestIsSafe(manifest: EnvironmentManifest) {
  const apiUrl = new URL(manifest.apiBaseUrl)

  if (!manifest.appBasePath.startsWith('/') || !manifest.appBasePath.endsWith('/')) {
    throw new Error(`Invalid app base path for ${manifest.name}`)
  }

  if (!manifest.storagePrefix.startsWith('leai:')) {
    throw new Error(`Invalid browser storage prefix for ${manifest.name}`)
  }

  if (manifest.name === 'qa') {
    if (apiUrl.protocol !== 'https:' || /prod|production/i.test(apiUrl.hostname)) {
      throw new Error('QA manifest must not target a Production API host')
    }
  }

  if (manifest.name === 'production') {
    if (apiUrl.protocol !== 'https:' || /qa/i.test(apiUrl.hostname)) {
      throw new Error('Production manifest must not target a QA API host')
    }
  }
}

export function getEnvironment(source: EnvironmentSource = import.meta.env): EnvironmentManifest {
  assertPublicVariablesAreSafe(source)

  const configuredName = optionalString(source, 'VITE_LEAI_ENVIRONMENT')
  if (!configuredName) return localEnvironment

  const name = environmentNameSchema.parse(configuredName)
  if (name === 'local') {
    return localEnvironment
  }

  const manifest: EnvironmentManifest = {
    name,
    apiBaseUrl: requiredPublicValue(source, 'VITE_LEAI_API_BASE_URL'),
    appBasePath: requiredPublicValue(source, 'VITE_LEAI_APP_BASE_PATH'),
    storagePrefix: name === 'qa' ? 'leai:qa' : 'leai:prod',
    buildSha: requiredPublicValue(source, 'VITE_LEAI_BUILD_SHA'),
    environmentLabel: name === 'qa' ? 'QA' : 'Production',
    expectedBackend: {
      buildSha: requiredPublicValue(source, 'VITE_LEAI_BACKEND_BUILD_SHA'),
      schemaIdentity: requiredPublicValue(source, 'VITE_LEAI_SCHEMA_IDENTITY'),
      contractVersion: requiredPublicValue(source, 'VITE_LEAI_CONTRACT_VERSION'),
    },
  }

  assertManifestIsSafe(manifest)
  return manifest
}

export function qualifyBrowserKey(environment: EnvironmentName, key: string) {
  const prefix = environment === 'production' ? 'leai:prod' : `leai:${environment}`
  return `${prefix}:${key}`
}

export function verifyEnvironment(
  expected: EnvironmentManifest,
  observed: ObservedEnvironment,
): EnvironmentVerification {
  if (expected.name !== observed.environment) {
    return { ok: false, reason: `Expected ${expected.name}, received ${observed.environment}` }
  }
  if (expected.expectedBackend.buildSha !== observed.backendBuildSha) {
    return { ok: false, reason: 'Backend build identity does not match this application build' }
  }
  if (expected.expectedBackend.schemaIdentity !== observed.schemaIdentity) {
    return { ok: false, reason: 'Database or schema identity does not match this application build' }
  }
  if (expected.expectedBackend.contractVersion !== observed.contractVersion) {
    return { ok: false, reason: 'API contract version does not match this application build' }
  }
  if (!observed.allowedAppBases.includes(expected.appBasePath)) {
    return { ok: false, reason: 'Backend does not allow this application base path' }
  }

  return { ok: true }
}
