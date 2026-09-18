import { expect, it } from 'vitest'
import {
  getEnvironment,
  qualifyBrowserKey,
  type ObservedEnvironment,
  verifyEnvironment,
} from './environment'

const qaEnvironment = getEnvironment({
  VITE_LEAI_ENVIRONMENT: 'qa',
  VITE_LEAI_API_BASE_URL: 'https://leai-qa.invalid/api/',
  VITE_LEAI_APP_BASE_PATH: '/LEAI/qa/',
  VITE_LEAI_BUILD_SHA: 'unbound-qa-build',
  VITE_LEAI_BACKEND_BUILD_SHA: 'qa-backend-placeholder',
  VITE_LEAI_SCHEMA_IDENTITY: 'qa-schema-placeholder',
  VITE_LEAI_CONTRACT_VERSION: '2026-09-17',
})

const productionEnvironment = getEnvironment({
  VITE_LEAI_ENVIRONMENT: 'production',
  VITE_LEAI_API_BASE_URL: 'https://leai-production.invalid/api/',
  VITE_LEAI_APP_BASE_PATH: '/LEAI/',
  VITE_LEAI_BUILD_SHA: 'unbound-production-build',
  VITE_LEAI_BACKEND_BUILD_SHA: 'production-backend-placeholder',
  VITE_LEAI_SCHEMA_IDENTITY: 'production-schema-placeholder',
  VITE_LEAI_CONTRACT_VERSION: '2026-09-17',
})

it('accepts a matching QA backend identity and rejects a production identity', () => {
  const qaObserved: ObservedEnvironment = {
    environment: 'qa',
    backendBuildSha: qaEnvironment.expectedBackend.buildSha,
    schemaIdentity: qaEnvironment.expectedBackend.schemaIdentity,
    contractVersion: qaEnvironment.expectedBackend.contractVersion,
    allowedAppBases: [qaEnvironment.appBasePath],
    serverTime: '2026-09-17T20:00:00Z',
  }
  const prodObserved: ObservedEnvironment = {
    ...qaObserved,
    environment: 'production',
    backendBuildSha: productionEnvironment.expectedBackend.buildSha,
    schemaIdentity: productionEnvironment.expectedBackend.schemaIdentity,
  }

  expect(verifyEnvironment(qaEnvironment, qaObserved)).toEqual({ ok: true })
  expect(verifyEnvironment(qaEnvironment, prodObserved).ok).toBe(false)
})

it('qualifies browser state by environment', () => {
  expect(qualifyBrowserKey('qa', 'session')).toBe('leai:qa:session')
  expect(qualifyBrowserKey('production', 'session')).toBe('leai:prod:session')
})

it('rejects cross-environment and secret-like public variables', () => {
  expect(() =>
    getEnvironment({
      VITE_LEAI_ENVIRONMENT: 'qa',
      VITE_LEAI_API_BASE_URL: 'https://leai-production.invalid/api/',
      VITE_LEAI_APP_BASE_PATH: '/LEAI/qa/',
      VITE_LEAI_BUILD_SHA: 'unbound-qa-build',
      VITE_LEAI_BACKEND_BUILD_SHA: 'qa-backend-placeholder',
      VITE_LEAI_SCHEMA_IDENTITY: 'qa-schema-placeholder',
      VITE_LEAI_CONTRACT_VERSION: '2026-09-17',
    }),
  ).toThrow('QA manifest must not target a Production API host')

  expect(() => getEnvironment({ VITE_LEAI_TOKEN: 'not-allowed' })).toThrow(
    'appears to contain a secret',
  )
})
