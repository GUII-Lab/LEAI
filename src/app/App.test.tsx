import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('@/config/environment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/environment')>()
  return {
    ...actual,
    getEnvironment: () => ({
      name: 'qa',
      apiBaseUrl: 'https://leai-qa.invalid/api/',
      appBasePath: '/LEAI/qa/',
      storagePrefix: 'leai:qa',
      buildSha: 'test-build',
      environmentLabel: 'QA',
      expectedBackend: {
        buildSha: 'test-backend',
        schemaIdentity: 'test-schema',
        contractVersion: '2026-09-17',
      },
    }),
  }
})

it('identifies the LEAI application', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'LEAI' })).toBeInTheDocument()
})

it('keeps account and course navigation inside the QA application base', () => {
  render(<App />)

  expect(screen.getByRole('link', { name: 'All Courses' })).toHaveAttribute(
    'href',
    '/LEAI/qa/InstructorHome.html',
  )
  for (const link of screen.getAllByRole('link', { name: 'Prompt Designer' })) {
    expect(link).toHaveAttribute('href', '/LEAI/qa/PromptDesigner.html')
  }
})
