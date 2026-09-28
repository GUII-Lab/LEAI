import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { App } from './App'

const logoutSpy = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const instructorMeSpy = vi.hoisted(() => vi.fn())

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

vi.mock('./EnvironmentGate', () => ({
  EnvironmentGate: ({ children }: { children: React.ReactNode }) => children,
  useEnvironmentWriteAccess: () => true,
  useEnvironmentStatus: () => 'verified',
}))

vi.mock('@/api/instructor-v1', () => ({
  createInstructorApi: () => ({
    me: instructorMeSpy,
    courses: async () => ({ courses: [{ course_id: '11111111-1111-4111-8111-111111111111', course_code: 'CMPM-80H',
      course_name: 'CMPM 80H', institution_slug: 'ucsc', lifecycle_state: 'active', role: 'researcher', allowed_actions: [] }] }),
    debugSettings: async () => ({ debug_enabled: false, settings_version: 1 }),
    updateDebugSettings: async (_id: string, enabled: boolean) => ({ debug_enabled: enabled, settings_version: 2 }),
    logout: logoutSpy,
  }),
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  InstructorApiError: class InstructorApiError extends Error {
    status: number
    code: string
    constructor(status: number, code: string) { super(code); this.status = status; this.code = code }
  },
}))

beforeEach(() => {
  logoutSpy.mockClear()
  instructorMeSpy.mockReset()
  instructorMeSpy.mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222',
    email: 'teacher@ucsc.edu', display_name: 'Teacher', must_change_password: false,
    platform_role: 'member', institutions: [{ slug: 'ucsc', name: 'UC Santa Cruz', can_create_courses: true }] })
  sessionStorage.setItem('leai:qa:instructor-token', 'test-session-token')
  window.history.replaceState({}, '', '/LEAI/qa/InstructorHome.html')
})

it('signs out through the server before clearing the selected course', async () => {
  const user = userEvent.setup()
  sessionStorage.setItem('leai:qa:selected-course', '11111111-1111-4111-8111-111111111111')
  renderApp()
  await screen.findByRole('heading', { name: 'Your courses' })
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  await waitFor(() => expect(logoutSpy).toHaveBeenCalledOnce())
  await waitFor(() => expect(sessionStorage.getItem('leai:qa:selected-course')).toBeNull())
})

it('keeps course context and offers retry if server sign-out fails', async () => {
  logoutSpy.mockRejectedValueOnce(new Error('network unavailable'))
  sessionStorage.setItem('leai:qa:selected-course', '11111111-1111-4111-8111-111111111111')
  const user = userEvent.setup()
  renderApp()
  await screen.findByRole('heading', { name: 'Your courses' })

  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out')
  expect(sessionStorage.getItem('leai:qa:selected-course')).toBe('11111111-1111-4111-8111-111111111111')
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
})

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><App activeItem="all-courses" /></QueryClientProvider>)
}

it('renders the actual course workspace instead of an empty Instructor Home shell', async () => {
  renderApp()
  expect(await screen.findByRole('heading', { name: 'Your courses' })).toBeInTheDocument()
  expect(await screen.findByRole('article', { name: 'CMPM 80H' })).toBeInTheDocument()
})

it('shows the not-found page without checking instructor authentication', async () => {
  render(<QueryClientProvider client={new QueryClient()}><App activeItem="not-found" /></QueryClientProvider>)

  expect(await screen.findByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument()
  expect(instructorMeSpy).not.toHaveBeenCalled()
  expect(screen.queryByRole('navigation', { name: 'Course navigation' })).not.toBeInTheDocument()
})

it('keeps account and course navigation inside the QA application base', async () => {
  renderApp()

  expect(await screen.findByRole('link', { name: 'All Courses' })).toHaveAttribute(
    'href',
    '/LEAI/qa/InstructorHome.html',
  )
  expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute(
    'href', '/LEAI/qa/InstructorHome.html?view=account',
  )
})

it('shows the Researcher course debug switch in Settings and persists its change', async () => {
  const user = userEvent.setup()
  sessionStorage.setItem('leai:qa:selected-course', '11111111-1111-4111-8111-111111111111')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><App activeItem="settings" pageTitle="Settings" description="Adjust this course’s feedback settings." /></QueryClientProvider>)

  expect(await screen.findByRole('heading', { name: 'AI debug visibility' })).toBeInTheDocument()
  const toggle = await screen.findByRole('switch', { name: 'Enable AI debug panel' })
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  await user.click(toggle)
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable AI debug panel' })).toHaveAttribute('aria-checked', 'true'))
})

it('opens the public student survey without instructor navigation or sign-in', () => {
  render(<QueryClientProvider client={new QueryClient()}><App activeItem="feedback" pageTitle="Feedback" /></QueryClientProvider>)
  expect(screen.getByRole('heading', { name: 'Reflection' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Course navigation' })).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('invalid')
})
