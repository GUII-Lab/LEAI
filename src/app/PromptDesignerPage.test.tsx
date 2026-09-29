import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { createInstructorApi } from '@/api/instructor-v1'
import type { WizardDraft, WizardProtocol, WizardRevision, WizardSurvey } from '@/api/contracts/wizard'
import { getEnvironment } from '@/config/environment'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PromptDesignerPage } from './PromptDesignerPage'

const environment = getEnvironment({})
const courseId = '550e8400-e29b-41d4-a716-446655440000'
const questionSetId = '550e8400-e29b-41d4-a716-446655440010'
const revisionId = '550e8400-e29b-41d4-a716-446655440020'
const surveyId = '550e8400-e29b-41d4-a716-446655440030'
const timestamp = '2026-09-28T12:00:00Z'
const body: WizardProtocol = {
  version: 1, title: 'Weekly reflection', intro: 'Tell us about this week.', scales: {},
  sections: [{ id: 's1', title: 'Learning', items: [{
    id: 'q1', prompt: 'What stood out this week?', wording: 'adaptive',
    response: { kind: 'text' }, reflection_goal: 'Understand a concrete moment.',
    coverage_targets: [], example_probes: [], max_additional_probes: 1,
  }] }],
}
const draft: WizardDraft = {
  id: questionSetId, title: body.title, audience: 'individual', collection_style: 'guided',
  draft_version: 1, body, updated_at: timestamp, resumable: true,
}
const revision: WizardRevision = {
  id: revisionId, question_set_id: questionSetId, revision_number: 1, source_draft_version: 1,
  content_hash: 'a'.repeat(64), body, preview_decision: null, created_at: timestamp,
}
const survey: WizardSurvey = {
  id: surveyId, question_set_id: questionSetId, revision_id: revisionId, label: 'Week 1',
  audience: 'individual', collection_style: 'guided', state: 'open',
  direct_url: `feedback.html?id=${surveyId}`, opens_at: null, closes_at: null,
  team_setup_required: false, completion_certificate_enabled: false,
  completed_response_download_enabled: false, allowed_actions: ['copy_link'],
}

type Api = ReturnType<typeof createInstructorApi>
const api = {
  courses: vi.fn(),
  wizardDrafts: vi.fn(),
  wizardTemplates: vi.fn(),
  wizardSurveys: vi.fn(),
  wizardDraft: vi.fn(),
  wizardVersions: vi.fn(),
  wizardConversation: vi.fn(),
  createWizardDraft: vi.fn(),
  saveWizardDraft: vi.fn(),
  freezeWizardDraft: vi.fn(),
  wizardPreview: vi.fn(),
  wizardPreviewAnswer: vi.fn(),
  decideWizardPreview: vi.fn(),
  publishWizard: vi.fn(),
  job: vi.fn(),
  startWizardAi: vi.fn(),
  restoreWizardVersion: vi.fn(),
} as unknown as Api

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<TooltipProvider><QueryClientProvider client={client}><PromptDesignerPage api={api} environment={environment} verified /></QueryClientProvider></TooltipProvider>)
}

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('leai:local:selected-course', courseId)
  for (const method of Object.values(api)) if (vi.isMockFunction(method)) method.mockReset()
  vi.mocked(api.courses).mockResolvedValue({ courses: [{
    course_id: courseId, course_code: 'course', course_name: 'Course', institution_slug: 'test',
    lifecycle_state: 'active', role: 'owner', allowed_actions: ['feedback.author', 'feedback.publish'],
  }] })
  vi.mocked(api.wizardDrafts).mockResolvedValue({ question_sets: [] })
  vi.mocked(api.wizardTemplates).mockResolvedValue({ templates: [{
    id: 'weekly-reflection', name: 'Weekly reflection', description: 'A weekly check-in.',
    audience: 'individual', collection_style: 'guided', source: 'leai',
  }] })
  vi.mocked(api.wizardSurveys).mockResolvedValue({ surveys: [] })
  vi.mocked(api.wizardDraft).mockResolvedValue(draft)
  vi.mocked(api.wizardVersions).mockResolvedValue({ versions: [] })
  vi.mocked(api.wizardConversation).mockResolvedValue({ messages: [] })
  vi.mocked(api.createWizardDraft).mockResolvedValue(draft)
  vi.mocked(api.saveWizardDraft).mockImplementation(async (_course, _id, expected, edited) => ({
    ...draft, body: edited, title: edited.title, draft_version: expected + 1, changed: true,
  }))
  vi.mocked(api.freezeWizardDraft).mockResolvedValue({ revision })
  vi.mocked(api.wizardPreview).mockResolvedValue({ preview_id: '550e8400-e29b-41d4-a716-446655440040', revision, messages: [] })
  vi.mocked(api.decideWizardPreview).mockResolvedValue({ ...revision, preview_decision: 'skipped' })
  vi.mocked(api.publishWizard).mockResolvedValue(survey)
})

it('shows resume only for a valid resumable draft and keeps published surveys separate', async () => {
  vi.mocked(api.wizardDrafts).mockResolvedValue({ question_sets: [{ ...draft, resumable: false }] })
  vi.mocked(api.wizardSurveys).mockResolvedValue({ surveys: [survey] })
  renderPage()
  expect(await screen.findByText('Week 1')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Continue previous session' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create new feedback' })).toBeEnabled()
})

it('builds in five steps, uses the artifact and chat components, and publishes to a survey card', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Create new feedback' }))
  const builder = screen.getByRole('dialog', { name: 'Feedback Builder' })
  expect(within(builder).getByRole('list', { name: 'Feedback Builder steps' })).toHaveTextContent('Start')
  await user.click(await within(builder).findByRole('button', { name: /Weekly reflection/ }))
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  expect(within(builder).getByRole('radio', { name: 'Individual feedback' })).toBeChecked()
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  expect(await within(builder).findByRole('heading', { name: 'Feedback artifact' })).toBeInTheDocument()
  expect(within(builder).getByRole('log', { name: 'Conversation' })).toBeInTheDocument()
  expect(within(builder).getByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' })).toBeInTheDocument()
  await user.click(within(builder).getByRole('button', { name: 'Continue to preview' }))
  expect(await within(builder).findByRole('heading', { name: 'Preview the student experience' })).toBeInTheDocument()
  await user.click(within(builder).getByRole('button', { name: 'Skip preview for this revision' }))
  await waitFor(() => expect(within(builder).getByRole('button', { name: 'Continue to publish' })).toBeEnabled())
  await user.click(within(builder).getByRole('button', { name: 'Continue to publish' }))
  await user.click(within(builder).getByRole('button', { name: 'Publish feedback' }))
  await waitFor(() => expect(api.publishWizard).toHaveBeenCalledWith(courseId, revisionId, expect.objectContaining({ opens_at: null, closes_at: null }), expect.any(String)))
  expect(await screen.findByText('Feedback published. Copy the link from its survey card.')).toBeInTheDocument()
})

it('keeps Team Open unavailable and leaves the prior draft when closing', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Create new feedback' }))
  await user.click(screen.getByRole('button', { name: /^Continue$/ }))
  await user.click(screen.getByRole('radio', { name: 'Team feedback' }))
  expect(screen.getByRole('radio', { name: 'Open conversation' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Close builder' }))
  expect(screen.getByRole('alertdialog', { name: 'Leave the Builder?' })).toBeInTheDocument()
})
