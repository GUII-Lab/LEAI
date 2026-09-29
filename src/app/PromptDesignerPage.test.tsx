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
  direct_url: `feedback.html?id=${surveyId}`, opens_at: null, closes_at: null, response_count: 3,
  team_setup_required: false, completion_certificate_enabled: false,
  completed_response_download_enabled: false, allowed_actions: ['copy_link'],
}

type Api = ReturnType<typeof createInstructorApi>
const api = {
  courses: vi.fn(),
  wizardDrafts: vi.fn(),
  wizardTemplates: vi.fn(),
  wizardSurveys: vi.fn(),
  reviseWizardSurvey: vi.fn(),
  wizardDraft: vi.fn(),
  wizardVersions: vi.fn(),
  wizardConversation: vi.fn(),
  createWizardDraft: vi.fn(),
  saveWizardDraft: vi.fn(),
  freezeWizardDraft: vi.fn(),
  wizardPreview: vi.fn(),
  wizardRevision: vi.fn(),
  wizardPreviewAnswer: vi.fn(),
  decideWizardPreview: vi.fn(),
  publishWizard: vi.fn(),
  saveWizardTemplate: vi.fn(),
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
  vi.mocked(api.wizardRevision).mockResolvedValue(revision)
  vi.mocked(api.decideWizardPreview).mockResolvedValue({ ...revision, preview_decision: 'skipped' })
  vi.mocked(api.publishWizard).mockResolvedValue(survey)
  vi.mocked(api.saveWizardTemplate).mockResolvedValue({
    id: '550e8400-e29b-41d4-a716-446655440050', name: 'Research check-in', description: '',
    audience: 'individual', collection_style: 'guided', source: 'my',
  })
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
  let publishedSurveys: WizardSurvey[] = []
  vi.mocked(api.wizardSurveys).mockImplementation(async () => ({ surveys: publishedSurveys }))
  vi.mocked(api.publishWizard).mockRejectedValueOnce(new Error('network response lost'))
    .mockImplementationOnce(async () => {
    publishedSurveys = [survey]
    return survey
  })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Team' }))
  await user.click(await screen.findByRole('button', { name: 'Create new feedback' }))
  const builder = screen.getByRole('dialog', { name: 'Feedback Builder' })
  expect(within(builder).getByRole('list', { name: 'Feedback Builder steps' })).toHaveTextContent('Audience')
  expect(within(builder).getByRole('radio', { name: /Individual feedback/ })).toBeChecked()
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  expect(within(builder).getByRole('radio', { name: /Guided feedback/ })).toBeChecked()
  await user.click(await within(builder).findByRole('button', { name: /Weekly reflection/ }))
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  expect(await within(builder).findByRole('heading', { name: 'Feedback artifact' })).toBeInTheDocument()
  expect(within(builder).getByRole('log', { name: 'Conversation' })).toBeInTheDocument()
  expect(within(builder).getByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' })).toBeInTheDocument()
  const composer = within(builder).getByTestId('chat-composer')
  expect(within(composer).getByRole('button', { name: 'Dictate' })).toBeInTheDocument()
  expect(within(composer).getByRole('button', { name: 'Send' })).toHaveClass('chat-composer-send')
  await user.click(within(builder).getByRole('button', { name: 'Continue to preview' }))
  expect(await within(builder).findByRole('heading', { name: 'Preview the student experience' })).toBeInTheDocument()
  const open = vi.spyOn(window, 'open').mockReturnValue({} as Window)
  await user.click(within(builder).getByRole('button', { name: /Open student preview/ }))
  expect(open).toHaveBeenCalledWith(`/WizardPreview.html?revision=${revisionId}`, '_blank')
  open.mockRestore()
  await user.click(within(builder).getByRole('button', { name: 'Skip preview for this revision' }))
  await waitFor(() => expect(within(builder).getByRole('button', { name: 'Continue to publish' })).toBeEnabled())
  await user.click(within(builder).getByRole('button', { name: 'Continue to publish' }))
  await user.click(within(builder).getByRole('button', { name: 'Publish feedback' }))
  expect(await within(builder).findByRole('alert')).toHaveTextContent('Could not complete this action. Please try again.')
  await user.click(within(builder).getByRole('button', { name: 'Publish feedback' }))
  await waitFor(() => expect(api.publishWizard).toHaveBeenCalledWith(courseId, revisionId, expect.objectContaining({ opens_at: null, closes_at: null }), expect.any(String)))
  expect(vi.mocked(api.publishWizard).mock.calls[1]?.[3]).toBe(vi.mocked(api.publishWizard).mock.calls[0]?.[3])
  expect(await within(builder).findByRole('heading', { name: 'Feedback published' })).toBeInTheDocument()
  await user.click(within(builder).getByRole('button', { name: 'Complete / Return to surveys' }))
  expect(await screen.findByText('Week 1')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Feedback Builder' })).not.toBeInTheDocument())
  const publishedCard = screen.getByText('Week 1').closest('li')
  await waitFor(() => expect(publishedCard).toHaveFocus())
  expect(publishedCard).toHaveClass('ring-2', 'ring-primary')
})

it('warns when the Wizard AI provider outcome is unknown without resending', async () => {
  const jobId = '550e8400-e29b-41d4-a716-446655440060'
  vi.mocked(api.startWizardAi).mockResolvedValue({ job_id: jobId })
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'failed', error_code: 'provider_outcome_unknown', result: null })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Create new feedback' }))
  const builder = screen.getByRole('dialog', { name: 'Feedback Builder' })
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await user.click(await within(builder).findByRole('button', { name: /Weekly reflection/ }))
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  const input = await within(builder).findByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' })
  await user.type(input, 'Shorten the introduction')
  await user.click(within(builder).getByRole('button', { name: 'Send' }))
  expect(await within(builder).findByText(/LEAI could not confirm whether its AI request finished/, {}, { timeout: 3000 })).toBeInTheDocument()
  expect(api.startWizardAi).toHaveBeenCalledTimes(1)
})

it('shows an administrator-cancelled Wizard edit without resending', async () => {
  const jobId = '550e8400-e29b-41d4-a716-446655440061'
  vi.mocked(api.startWizardAi).mockResolvedValue({ job_id: jobId })
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'cancelled', error_code: 'admin_cancelled', result: null })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Create new feedback' }))
  const builder = screen.getByRole('dialog', { name: 'Feedback Builder' })
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await user.click(await within(builder).findByRole('button', { name: /Weekly reflection/ }))
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await user.type(await within(builder).findByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' }), 'Shorten the introduction')
  await user.click(within(builder).getByRole('button', { name: 'Send' }))
  expect(await within(builder).findByText(/LEAI stopped this draft edit/, {}, { timeout: 3000 })).toBeInTheDocument()
  expect(api.startWizardAi).toHaveBeenCalledTimes(1)
})

it('keeps Team Open unavailable and leaves the prior draft when closing', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Create new feedback' }))
  await user.click(screen.getByRole('radio', { name: /Team feedback/ }))
  await user.click(screen.getByRole('button', { name: /^Continue$/ }))
  expect(screen.getByRole('radio', { name: /Open conversation/ })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Close builder' }))
  expect(screen.getByRole('alertdialog', { name: 'Leave the Builder?' })).toBeInTheDocument()
})


it('saves an exact revision privately from a focused template modal and restores focus', async () => {
  const savedTemplate = {
    id: '550e8400-e29b-41d4-a716-446655440050', name: 'Research check-in', description: '',
    audience: 'individual' as const, collection_style: 'guided' as const, source: 'my' as const,
  }
  const starterTemplate = {
    id: 'weekly-reflection', name: 'Weekly reflection', description: 'A weekly check-in.',
    audience: 'individual' as const, collection_style: 'guided' as const, source: 'leai' as const,
  }
  vi.mocked(api.wizardTemplates).mockResolvedValueOnce({ templates: [starterTemplate] })
    .mockResolvedValueOnce({ templates: [starterTemplate, savedTemplate] })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Create new feedback' }))
  const builder = screen.getByRole('dialog', { name: 'Feedback Builder' })
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await user.click(await within(builder).findByRole('button', { name: /Weekly reflection/ }))
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await within(builder).findByRole('heading', { name: 'Feedback artifact' })
  await user.click(within(builder).getByRole('button', { name: 'Continue to preview' }))
  await user.click(await within(builder).findByRole('button', { name: 'Skip preview for this revision' }))
  await waitFor(() => expect(within(builder).getByRole('button', { name: 'Continue to publish' })).toBeEnabled())
  await user.click(within(builder).getByRole('button', { name: 'Continue to publish' }))

  const trigger = within(builder).getByRole('button', { name: 'Save as My template' })
  await user.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Save as My template' })
  const name = within(dialog).getByRole('textbox', { name: 'Template name' })
  await user.clear(name)
  await user.click(within(dialog).getByRole('button', { name: 'Save template' }))
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a template name.')
  expect(api.saveWizardTemplate).not.toHaveBeenCalled()

  await user.type(name, 'Research check-in')
  await user.click(within(dialog).getByRole('button', { name: 'Save template' }))
  await waitFor(() => expect(api.saveWizardTemplate).toHaveBeenCalledWith(courseId, revisionId, 'Research check-in', expect.any(String)))
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Saved privately to My templates.')
  await user.click(within(dialog).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(trigger).toHaveFocus())
  await waitFor(() => expect(api.wizardTemplates).toHaveBeenCalledTimes(2))

  await user.click(within(builder).getByRole('button', { name: 'Close builder' }))
  const leaveDialog = screen.getByRole('alertdialog', { name: 'Leave the Builder?' })
  await user.click(within(leaveDialog).getByRole('button', { name: 'Save and close' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Feedback Builder' })).not.toBeInTheDocument())
  await user.click(await screen.findByRole('button', { name: 'Create new feedback' }))
  const nextBuilder = screen.getByRole('dialog', { name: 'Feedback Builder' })
  await user.click(within(nextBuilder).getByRole('button', { name: /^Continue$/ }))
  await user.click(within(nextBuilder).getByRole('tab', { name: 'My templates' }))
  expect(await within(nextBuilder).findByRole('button', { name: /Research check-in/ })).toBeInTheDocument()
})


it('shows save progress and a recoverable error for a failed private template save', async () => {
  let releaseSave!: () => void
  vi.mocked(api.saveWizardTemplate).mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => { releaseSave = resolve })
    throw new Error('network failure')
  })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Create new feedback' }))
  const builder = screen.getByRole('dialog', { name: 'Feedback Builder' })
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await user.click(await within(builder).findByRole('button', { name: /Weekly reflection/ }))
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await within(builder).findByRole('heading', { name: 'Feedback artifact' })
  await user.click(within(builder).getByRole('button', { name: 'Continue to preview' }))
  await user.click(await within(builder).findByRole('button', { name: 'Skip preview for this revision' }))
  await waitFor(() => expect(within(builder).getByRole('button', { name: 'Continue to publish' })).toBeEnabled())
  await user.click(within(builder).getByRole('button', { name: 'Continue to publish' }))
  await user.click(within(builder).getByRole('button', { name: 'Save as My template' }))
  const dialog = screen.getByRole('dialog', { name: 'Save as My template' })
  await user.click(within(dialog).getByRole('button', { name: 'Save template' }))
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Saving privately…')
  await waitFor(() => expect(releaseSave).toBeTypeOf('function'))
  releaseSave()
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not complete this action. Please try again.')
  expect(within(dialog).getByRole('button', { name: 'Save template' })).toBeEnabled()
  const firstKey = vi.mocked(api.saveWizardTemplate).mock.calls[0]?.[3]
  await user.click(within(dialog).getByRole('button', { name: 'Save template' }))
  await waitFor(() => expect(api.saveWizardTemplate).toHaveBeenCalledTimes(2))
  expect(vi.mocked(api.saveWizardTemplate).mock.calls[1]?.[3]).toBe(firstKey)
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Saved privately to My templates.')
})

it('creates and opens a revised draft only when the survey allows that action', async () => {
  const revisableSurvey: WizardSurvey = { ...survey, allowed_actions: ['copy_link', 'create_revised_version'] }
  vi.mocked(api.wizardSurveys).mockResolvedValue({ surveys: [revisableSurvey] })
  vi.mocked(api.reviseWizardSurvey).mockResolvedValue(draft)
  const user = userEvent.setup()
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Create revised version' }))

  await waitFor(() => expect(api.reviseWizardSurvey).toHaveBeenCalledWith(courseId, surveyId, expect.any(String)))
  const builder = await screen.findByRole('dialog', { name: draft.title })
  expect(await within(builder).findByRole('heading', { name: 'Feedback artifact' })).toBeInTheDocument()
  expect(within(builder).getByText('Created a new draft from “Week 1”. The published survey and its responses are unchanged.')).toBeInTheDocument()
  expect(api.wizardDraft).toHaveBeenCalledWith(courseId, questionSetId)
  expect(api.publishWizard).not.toHaveBeenCalled()
})

it('filters surveys by audience and individual collection style with specific empty states', async () => {
  const individualOpen: WizardSurvey = {
    ...survey,
    id: '550e8400-e29b-41d4-a716-446655440031',
    revision_id: '550e8400-e29b-41d4-a716-446655440021',
    label: 'Open week',
    collection_style: 'open',
  }
  const teamSurvey: WizardSurvey = {
    ...survey,
    id: '550e8400-e29b-41d4-a716-446655440032',
    revision_id: '550e8400-e29b-41d4-a716-446655440022',
    label: 'Team week',
    audience: 'team',
  }
  vi.mocked(api.wizardSurveys).mockResolvedValue({ surveys: [survey, individualOpen, teamSurvey] })
  const user = userEvent.setup()
  renderPage()

  const audienceFilters = await screen.findByRole('group', { name: 'Survey filter' })
  await user.click(within(audienceFilters).getByRole('button', { name: 'Individual' }))
  const styleFilters = screen.getByRole('group', { name: 'Individual survey format' })
  expect(screen.getByText('Week 1')).toBeInTheDocument()
  expect(screen.getByText('Open week')).toBeInTheDocument()
  expect(screen.queryByText('Team week')).not.toBeInTheDocument()

  await user.click(within(styleFilters).getByRole('button', { name: 'Open' }))
  expect(screen.queryByText('Week 1')).not.toBeInTheDocument()
  expect(screen.getByText('Open week')).toBeInTheDocument()

  await user.click(within(audienceFilters).getByRole('button', { name: 'Team' }))
  expect(screen.getByText('Team week')).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Individual survey format' })).not.toBeInTheDocument()

  await user.click(within(audienceFilters).getByRole('button', { name: 'Individual' }))
  await user.click(within(screen.getByRole('group', { name: 'Individual survey format' })).getByRole('button', { name: 'Guided' }))
  expect(screen.getByText('Week 1')).toBeInTheDocument()
  expect(screen.queryByText('Open week')).not.toBeInTheDocument()
})

it('uses a filter-specific empty state when an audience has no published surveys', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Team' }))
  expect(await screen.findByText('No team feedback yet.')).toBeInTheDocument()
})

it('keeps response count, schedule dates, and the student link on the survey card', async () => {
  vi.mocked(api.wizardSurveys).mockResolvedValue({ surveys: [{
    ...survey,
    state: 'scheduled',
    response_count: 2,
    opens_at: '2026-10-01T15:30:00Z',
    closes_at: '2026-10-08T23:59:00Z',
  }] })
  renderPage()

  const card = (await screen.findByText('Week 1')).closest('li')
  expect(card).toHaveTextContent('scheduled · 2 responses')
  expect(card).toHaveTextContent('Opens')
  expect(card).toHaveTextContent('Closes')
  expect(within(card as HTMLElement).getByRole('link', { name: 'Open survey' })).toHaveAttribute('href', expect.stringContaining('feedback.html?id='))
})
