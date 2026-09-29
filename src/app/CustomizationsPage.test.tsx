import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthenticationRequiredError, InstructorApiError } from '@/api/instructor-v1'
import { getEnvironment, qualifyBrowserKey } from '@/config/environment'
import { CustomizationsPage } from './CustomizationsPage'

const environment = getEnvironment({})
const courseId = '11111111-1111-4111-8111-111111111111'
type TestInstructorApi = NonNullable<Parameters<typeof CustomizationsPage>[0]['api']>
const courses = { courses: [{ course_id: courseId, course_code: 'CMPM-80H', course_name: 'CMPM 80H',
  institution_slug: 'ucsc', lifecycle_state: 'active' as const, role: 'researcher' as const, allowed_actions: ['course.manage'] }] }

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
    studentPdfSettings: vi.fn().mockResolvedValue({ include_ai_conversation_in_student_pdf: false, settings_version: 1 }),
    referralSettings: vi.fn().mockResolvedValue({ referral_enabled: false, settings_version: 1 }),
    updateReferralSettings: vi.fn().mockImplementation(async (_id: string, input: { referral_enabled: boolean }) => ({
      referral_enabled: input.referral_enabled, settings_version: 2,
    })),
    updateStudentPdfSettings: vi.fn().mockImplementation(async (_id: string, input: Record<string, unknown>) => ({
      include_ai_conversation_in_student_pdf: input.include_ai_conversation_in_student_pdf, settings_version: 2,
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


it('shows the default-off PDF privacy choice and persists opt-in with the current course version', async () => {
  const api = makeApi()
  const user = userEvent.setup()
  renderPage(api)

  const toggle = await screen.findByRole('switch', { name: 'Include AI conversation in student PDF' })
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByText('Off')).toBeInTheDocument()
  await user.click(toggle)
  await waitFor(() => expect(api.updateStudentPdfSettings).toHaveBeenCalledWith(courseId, {
    include_ai_conversation_in_student_pdf: true, expected_settings_version: 1,
  }))
  expect(await screen.findByRole('status')).toHaveTextContent('Student PDF setting saved')
})

it('offers the default-off student support switch without reporting success before persistence', async () => {
  const api = makeApi()
  let resolveSave!: (value: { referral_enabled: boolean; settings_version: number }) => void
  api.updateReferralSettings = vi.fn().mockImplementation(() => new Promise((resolve) => { resolveSave = resolve }))
  const user = userEvent.setup()
  renderPage(api)

  const toggle = await screen.findByRole('switch', { name: 'Suggest contacting an instructor or TA' })
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByRole('heading', { name: 'Student support' })).toBeInTheDocument()
  expect(toggle).toHaveAccessibleDescription(/once per conversation.*stuck/i)
  expect(screen.getByText(/subsequent replies/)).toHaveTextContent(/no.*contact.*sent/i)
  await user.click(toggle)
  expect(toggle).toBeDisabled()
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(screen.queryByText('Student support setting saved.')).not.toBeInTheDocument()
  expect(api.updateReferralSettings).toHaveBeenCalledWith(courseId, { referral_enabled: true, expected_settings_version: 1 })
  resolveSave({ referral_enabled: true, settings_version: 2 })
  expect(await screen.findByText('Student support setting saved.')).toBeInTheDocument()
  expect(toggle).toHaveAttribute('aria-checked', 'true')
})

it.each([true, false])('reloads a version conflict and retries the intended value %s, not the inverse of refreshed state', async (intended) => {
  const api = makeApi()
  api.referralSettings = vi.fn()
    .mockResolvedValueOnce({ referral_enabled: !intended, settings_version: 1 })
    .mockResolvedValue({ referral_enabled: intended, settings_version: 3 })
  api.updateReferralSettings = vi.fn()
    .mockRejectedValueOnce(new InstructorApiError(409, 'settings_version_conflict'))
    .mockResolvedValueOnce({ referral_enabled: intended, settings_version: 4 })
  const user = userEvent.setup()
  renderPage(api)
  const toggle = await screen.findByRole('switch', { name: 'Suggest contacting an instructor or TA' })
  await user.click(toggle)
  const retry = await screen.findByRole('button', { name: `Retry turning ${intended ? 'On' : 'Off'}` })
  await waitFor(() => expect(retry).toBeEnabled())
  expect(api.referralSettings).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('Student support setting saved.')).not.toBeInTheDocument()
  await user.click(retry)
  await waitFor(() => expect(api.updateReferralSettings).toHaveBeenLastCalledWith(courseId, {
    referral_enabled: intended, expected_settings_version: 3,
  }))
  expect(await screen.findByText('Student support setting saved.')).toBeInTheDocument()
  expect(toggle).toHaveAttribute('aria-checked', String(intended))
})

it('keeps the intended change but blocks a conflict retry until a failed reload succeeds', async () => {
  const api = makeApi()
  api.referralSettings = vi.fn()
    .mockResolvedValueOnce({ referral_enabled: true, settings_version: 1 })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ referral_enabled: false, settings_version: 9 })
  api.updateReferralSettings = vi.fn()
    .mockRejectedValueOnce(new InstructorApiError(409, 'settings_version_conflict'))
    .mockResolvedValue({ referral_enabled: false, settings_version: 10 })
  const user = userEvent.setup()
  renderPage(api)
  await user.click(await screen.findByRole('switch', { name: 'Suggest contacting an instructor or TA' }))
  const retry = await screen.findByRole('button', { name: 'Retry turning Off' })
  expect(retry).toBeDisabled()
  expect(screen.queryByRole('switch', { name: 'Suggest contacting an instructor or TA' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reload student support setting' }))
  await waitFor(() => expect(retry).toBeEnabled())
  await user.click(retry)
  await screen.findByText('Student support setting saved.')
  expect(api.updateReferralSettings).toHaveBeenLastCalledWith(courseId, { referral_enabled: false, expected_settings_version: 9 })
})

it('does not treat a failed initial load as default-off and allows recovery', async () => {
  const api = makeApi()
  api.referralSettings = vi.fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ referral_enabled: true, settings_version: 4 })
  const user = userEvent.setup()
  renderPage(api)
  expect(await screen.findByText('Could not load student support settings.')).toBeInTheDocument()
  expect(screen.queryByRole('switch', { name: 'Suggest contacting an instructor or TA' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reload student support setting' }))
  expect(await screen.findByRole('switch', { name: 'Suggest contacting an instructor or TA' })).toHaveAttribute('aria-checked', 'true')
  expect(api.updateReferralSettings).not.toHaveBeenCalled()
})

it('supports keyboard activation of the shared student support switch', async () => {
  const api = makeApi()
  const user = userEvent.setup()
  renderPage(api)
  const toggle = await screen.findByRole('switch', { name: 'Suggest contacting an instructor or TA' })
  toggle.focus()
  await user.keyboard(' ')
  await screen.findByText('Student support setting saved.')
  expect(toggle).toHaveAttribute('aria-checked', 'true')
})

it('does not request referral settings before environment verification or without a selected course', async () => {
  const api = makeApi()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { rerender } = render(<QueryClientProvider client={client}><CustomizationsPage api={api} environment={environment} verified={false} /></QueryClientProvider>)
  expect(screen.getByText(/Waiting for backend identity verification/)).toBeInTheDocument()
  expect(api.referralSettings).not.toHaveBeenCalled()
  rerender(<QueryClientProvider client={client}><CustomizationsPage api={api} environment={environment} verified /></QueryClientProvider>)
  await screen.findByRole('heading', { name: 'AI debug visibility' })
  expect(api.referralSettings).not.toHaveBeenCalled()
  expect(screen.queryByRole('switch', { name: 'Suggest contacting an instructor or TA' })).not.toBeInTheDocument()
})

it('keeps the confirmed setting after a failed save', async () => {
  const api = makeApi()
  api.referralSettings = vi.fn().mockResolvedValue({ referral_enabled: true, settings_version: 5 })
  api.updateReferralSettings = vi.fn().mockRejectedValue(new Error('offline'))
  const user = userEvent.setup()
  renderPage(api)
  const toggle = await screen.findByRole('switch', { name: 'Suggest contacting an instructor or TA' })
  await user.click(toggle)
  expect(await screen.findByText(/Could not save the student support setting/)).toBeInTheDocument()
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  expect(screen.queryByText('Student support setting saved.')).not.toBeInTheDocument()
})

it('does not fetch or offer referral controls without course.manage', async () => {
  const api = makeApi()
  api.courses = vi.fn().mockResolvedValue({ courses: [{ ...courses.courses[0], allowed_actions: [] }] })
  renderPage(api)
  expect(await screen.findByText(/course management access.*student support/)).toBeInTheDocument()
  expect(api.referralSettings).not.toHaveBeenCalled()
  expect(screen.queryByRole('switch', { name: 'Suggest contacting an instructor or TA' })).not.toBeInTheDocument()
})

it.each(['load', 'save'] as const)('handles referral 404 on %s without showing an actionable stale switch', async (stage) => {
  const api = makeApi()
  const user = userEvent.setup()
  if (stage === 'load') api.referralSettings = vi.fn().mockRejectedValue(new InstructorApiError(404, 'not_found'))
  else api.updateReferralSettings = vi.fn().mockRejectedValue(new InstructorApiError(404, 'not_found'))
  renderPage(api)
  if (stage === 'save') await user.click(await screen.findByRole('switch', { name: 'Suggest contacting an instructor or TA' }))
  expect(await screen.findByText(/course management access.*student support/)).toBeInTheDocument()
  expect(screen.queryByRole('switch', { name: 'Suggest contacting an instructor or TA' })).not.toBeInTheDocument()
})

it.each(['load', 'save'] as const)('offers sign-in after referral 401 on %s', async (stage) => {
  const api = makeApi()
  const user = userEvent.setup()
  if (stage === 'load') api.referralSettings = vi.fn().mockRejectedValue(new AuthenticationRequiredError())
  else api.updateReferralSettings = vi.fn().mockRejectedValue(new AuthenticationRequiredError())
  renderPage(api)
  if (stage === 'save') await user.click(await screen.findByRole('switch', { name: 'Suggest contacting an instructor or TA' }))
  expect(await screen.findByRole('link', { name: 'Sign in again' })).toHaveAttribute('href', expect.stringContaining('InstructorLogin.html?next='))
  expect(screen.queryByRole('switch', { name: 'Suggest contacting an instructor or TA' })).not.toBeInTheDocument()
})

it('refreshes all other course setting versions after saving student support', async () => {
  const api = makeApi()
  const user = userEvent.setup()
  renderPage(api)
  await user.click(await screen.findByRole('switch', { name: 'Suggest contacting an instructor or TA' }))
  await screen.findByText('Student support setting saved.')
  for (const read of [api.courseBannerSettings, api.studentPdfSettings, api.debugSettings, api.settings]) {
    expect(read).toHaveBeenCalledTimes(2)
  }
})

it.each([
  ['switch', 'Include AI conversation in student PDF'],
  ['switch', 'Enable AI debug panel'],
  ['switch', 'Enable anonymous cross-week matching'],
  ['button', 'Save banner'],
])('refreshes the referral version after saving %s %s', async (role, name) => {
  const api = makeApi()
  api.referralSettings = vi.fn()
    .mockResolvedValueOnce({ referral_enabled: false, settings_version: 1 })
    .mockResolvedValue({ referral_enabled: false, settings_version: 2 })
  const user = userEvent.setup()
  renderPage(api)
  await screen.findByRole('switch', { name: 'Suggest contacting an instructor or TA' })
  await user.click(await screen.findByRole(role, { name }))
  await waitFor(() => expect(api.referralSettings).toHaveBeenCalledTimes(2))
  await user.click(screen.getByRole('switch', { name: 'Suggest contacting an instructor or TA' }))
  await waitFor(() => expect(api.updateReferralSettings).toHaveBeenCalledWith(courseId, {
    referral_enabled: true, expected_settings_version: 2,
  }))
})
