import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { InstructorApiError } from '@/api/instructor-v1'
import { getEnvironment, qualifyBrowserKey } from '@/config/environment'
import { CustomizationsPage } from './CustomizationsPage'

const environment = getEnvironment({})
const courseId = '11111111-1111-4111-8111-111111111111'
type TestInstructorApi = NonNullable<Parameters<typeof CustomizationsPage>[0]['api']>
const courses = { courses: [{ course_id: courseId, course_code: 'CMPM-80H', course_name: 'CMPM 80H',
  institution_slug: 'ucsc', lifecycle_state: 'active' as const, role: 'researcher' as const, allowed_actions: [] }] }

function makeApi(overrides: Partial<{ settings: () => Promise<{ debug_enabled: boolean; settings_version: number }> }> = {}): TestInstructorApi {
  const bannerSettings = {
    banner_enabled: false, banner_text: '', banner_dismissible: false, banner_display_mode: 'persistent' as const,
    banner_duration_seconds: 10, banner_split_enabled: false, banner_split_mode: 'percentage' as const,
    banner_split_value: 50, settings_version: 1,
  }
  return {
    courses: vi.fn().mockResolvedValue(courses),
    debugSettings: vi.fn().mockImplementation(overrides.settings ?? (() => Promise.resolve({ debug_enabled: false, settings_version: 1 }))),
    updateDebugSettings: vi.fn().mockImplementation(async (_id: string, enabled: boolean) => ({ debug_enabled: enabled, settings_version: 2 })),
    settings: vi.fn().mockResolvedValue({ anonymous_matching_enabled: false, settings_version: 1 }),
    updateSettings: vi.fn().mockImplementation(async (_id: string, input: { anonymous_matching_enabled: boolean }) => ({
      anonymous_matching_enabled: input.anonymous_matching_enabled, settings_version: 2,
    })),
    courseBannerSettings: vi.fn().mockResolvedValue(bannerSettings),
    updateCourseBannerSettings: vi.fn().mockImplementation(async (_id: string, input: Record<string, unknown>) => ({
      ...input, expected_settings_version: undefined, settings_version: 2,
    })),
  } as unknown as TestInstructorApi
}

function renderPage(api: ReturnType<typeof makeApi>, selectedEnvironment = environment) {
  sessionStorage.setItem(qualifyBrowserKey(selectedEnvironment.name, 'selected-course'), courseId)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><CustomizationsPage api={api} environment={selectedEnvironment} verified /></QueryClientProvider>)
}

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('leai:local:instructor-token', 'researcher-session-token')
})

it('persists the researcher switch with the current course settings version', async () => {
  const api = makeApi()
  const user = userEvent.setup()
  renderPage(api)

  expect(screen.queryByRole('combobox', { name: 'Course' })).not.toBeInTheDocument()
  const toggle = await screen.findByRole('switch', { name: 'Enable AI debug panel' })
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  await user.click(toggle)
  await waitFor(() => expect(api.updateDebugSettings).toHaveBeenCalledWith(courseId, true, 1))
  expect(await screen.findByRole('status')).toHaveTextContent('Researcher debug setting saved')
})

it('does not show the switch when the backend denies Researcher permission', async () => {
  const api = makeApi({ settings: async () => { throw new InstructorApiError(404, 'not_found') } })
  renderPage(api)

  expect(await screen.findByText(/Only an authorized institutional Researcher/)).toBeInTheDocument()
  expect(screen.queryByRole('switch', { name: 'Enable AI debug panel' })).not.toBeInTheDocument()
})

it('never requests or displays debug settings in Production', async () => {
  const api = makeApi()
  const production = { ...environment, name: 'production' as const }
  sessionStorage.setItem('leai:prod:instructor-token', 'researcher-session-token')
  renderPage(api, production)

  expect(await screen.findByText('AI debug state is disabled in Production.')).toBeInTheDocument()
  expect(api.debugSettings).not.toHaveBeenCalled()
  expect(screen.queryByRole('switch', { name: 'Enable AI debug panel' })).not.toBeInTheDocument()
})


it('persists course-enabled anonymous matching from Customizations with optimistic versioning', async () => {
  const api = makeApi()
  api.settings = vi.fn().mockResolvedValue({ anonymous_matching_enabled: false, settings_version: 3 })
  api.updateSettings = vi.fn().mockResolvedValue({ anonymous_matching_enabled: true, settings_version: 4 })
  const user = userEvent.setup()
  renderPage(api)

  const toggle = await screen.findByRole('switch', { name: 'Enable anonymous cross-week matching' })
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  await user.click(toggle)
  await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith(courseId, {
    anonymous_matching_enabled: true, expected_settings_version: 3,
  }))
  expect(await screen.findByText('Anonymous matching setting saved.')).toBeInTheDocument()
})

it('edits and saves the current course banner with its settings version', async () => {
  const api = makeApi()
  const user = userEvent.setup()
  renderPage(api)
  const text = await screen.findByRole('textbox', { name: 'Banner text' })
  await user.type(text, 'Welcome to the course')
  await user.click(screen.getByRole('switch', { name: 'Show the banner to students' }))
  await user.click(screen.getByRole('button', { name: 'Save banner' }))
  await waitFor(() => expect(api.updateCourseBannerSettings).toHaveBeenCalledWith(courseId, expect.objectContaining({
    banner_enabled: true, banner_text: 'Welcome to the course', expected_settings_version: 1,
  })))
  expect(await screen.findByRole('status')).toHaveTextContent('Course banner saved')
})
