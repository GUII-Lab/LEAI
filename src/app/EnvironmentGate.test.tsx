import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { getEnvironment, type ObservedEnvironment } from '@/config/environment'
import { fetchEnvironmentIdentity } from '@/api/environment'
import { EnvironmentGate, useEnvironmentWriteAccess } from './EnvironmentGate'

vi.mock('@/api/environment', () => ({
  fetchEnvironmentIdentity: vi.fn(),
}))

const qaEnvironment = getEnvironment({
  VITE_LEAI_ENVIRONMENT: 'qa',
  VITE_LEAI_API_BASE_URL: 'https://leai-qa.invalid/api/',
  VITE_LEAI_APP_BASE_PATH: '/LEAI/qa/',
  VITE_LEAI_BUILD_SHA: 'unbound-qa-build',
  VITE_LEAI_BACKEND_BUILD_SHA: 'qa-backend-placeholder',
  VITE_LEAI_SCHEMA_IDENTITY: 'qa-schema-placeholder',
  VITE_LEAI_CONTRACT_VERSION: '2026-09-17',
})

function WriteState() {
  return <span>{useEnvironmentWriteAccess() ? 'writes allowed' : 'read only'}</span>
}

it('grants write access only after a matching handshake', async () => {
  const observed: ObservedEnvironment = {
    environment: 'qa',
    backendBuildSha: qaEnvironment.expectedBackend.buildSha,
    schemaIdentity: qaEnvironment.expectedBackend.schemaIdentity,
    contractVersion: qaEnvironment.expectedBackend.contractVersion,
    allowedAppBases: [qaEnvironment.appBasePath],
    serverTime: '2026-09-17T20:00:00Z',
  }
  vi.mocked(fetchEnvironmentIdentity).mockResolvedValueOnce(observed)

  render(
    <EnvironmentGate environment={qaEnvironment}>
      <WriteState />
    </EnvironmentGate>,
  )

  expect(screen.getByText('read only')).toBeInTheDocument()
  expect(await screen.findByText('writes allowed')).toBeInTheDocument()
})

it('keeps the UI read-only after a mismatched handshake', async () => {
  vi.mocked(fetchEnvironmentIdentity).mockResolvedValueOnce({
    environment: 'production',
    backendBuildSha: 'production-backend-placeholder',
    schemaIdentity: 'production-schema-placeholder',
    contractVersion: qaEnvironment.expectedBackend.contractVersion,
    allowedAppBases: [qaEnvironment.appBasePath],
    serverTime: '2026-09-17T20:00:00Z',
  })

  render(
    <EnvironmentGate environment={qaEnvironment}>
      <WriteState />
    </EnvironmentGate>,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Read-only mode.')
  expect(screen.getByText('read only')).toBeInTheDocument()
})
