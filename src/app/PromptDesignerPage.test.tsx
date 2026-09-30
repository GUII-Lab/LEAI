import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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
  deleteWizardDraft: vi.fn(),
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

const pendingRequests: { promise: Promise<unknown>; reject: (cause: unknown) => void }[] = []
afterEach(async () => {
  const requests = pendingRequests.splice(0)
  await act(async () => {
    for (const request of requests) request.reject(new Error('Test request cleanup'))
    await Promise.allSettled(requests.map((request) => request.promise))
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  pendingRequests.push({ promise, reject })
  void promise.catch(() => {})
  return { promise, resolve, reject }
}

async function resumeChat() {
  vi.mocked(api.wizardDrafts).mockResolvedValue({ question_sets: [draft] })
  const user = userEvent.setup({ delay: null })
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Continue previous session' }))
  const input = await screen.findByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' })
  return { user, input, log: screen.getByRole('log', { name: 'Conversation' }), form: input.closest('form')! }
}

it('shows the submitted instruction before save/ACK, snapshots it once, and locks duplicate sends through reconciliation', async () => {
  const save = deferred<Awaited<ReturnType<Api['saveWizardDraft']>>>()
  const ack = deferred<{ job_id: string }>()
  const refresh = deferred<Awaited<ReturnType<Api['wizardConversation']>>>()
  const jobId = '550e8400-e29b-41d4-a716-446655440060'
  const oldMessage = { id: '1', role: 'user' as const, content: 'Shorten it', created_at: timestamp }
  vi.mocked(api.wizardConversation).mockResolvedValue({ messages: [oldMessage] })
  vi.mocked(api.saveWizardDraft).mockReturnValue(save.promise)
  vi.mocked(api.startWizardAi).mockReturnValue(ack.promise)
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'completed', error_code: null, result: null })
  const { user, input, log, form } = await resumeChat()
  await user.click(screen.getByRole('textbox', { name: 'Feedback title' }))
  await user.paste(' revised')
  await user.click(input)
  await user.paste('Shorten it')
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(within(log).getAllByText('Shorten it')).toHaveLength(2)
  expect(input).toHaveValue('')
  expect(input).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled()
  await user.click(input)
  await user.paste('Next instruction')
  fireEvent.submit(form)
  await act(async () => save.resolve({ ...draft, draft_version: 2, changed: true }))
  await waitFor(() => expect(api.startWizardAi).toHaveBeenCalledExactlyOnceWith(courseId, questionSetId, 'Shorten it', 2, expect.any(String)))
  expect(input).toHaveValue('Next instruction')
  fireEvent.submit(form)
  vi.mocked(api.wizardConversation).mockResolvedValue({ messages: [oldMessage, { ...oldMessage, id: '2' }] })
  await act(async () => ack.resolve({ job_id: jobId }))
  await waitFor(() => expect(within(log).getAllByText('Shorten it')).toHaveLength(2))
  expect(input).toHaveValue('Next instruction')
  vi.mocked(api.wizardConversation).mockReturnValue(refresh.promise)
  await waitFor(() => expect(api.job).toHaveBeenCalled(), { timeout: 3000 })
  fireEvent.submit(form)
  expect(api.startWizardAi).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled()
  await act(async () => refresh.resolve({ messages: [oldMessage, { ...oldMessage, id: '2' }, { id: '3', role: 'assistant', content: 'Updated.', created_at: timestamp }] }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled())
  expect(input).toHaveValue('Next instruction')
  expect(within(log).getAllByText('Shorten it')).toHaveLength(2)
}, 10000)

it.each(['save', 'ACK'] as const)('keeps a failed optimistic instruction and newer draft after %s failure', async (stage) => {
  const request = deferred<never>()
  if (stage === 'save') vi.mocked(api.saveWizardDraft).mockReturnValue(request.promise)
  else vi.mocked(api.startWizardAi).mockReturnValue(request.promise)
  const { user, input, log } = await resumeChat()
  if (stage === 'save') await user.type(screen.getByRole('textbox', { name: 'Feedback title' }), ' revised')
  await user.type(input, 'Submitted instruction')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(within(log).getByText('Submitted instruction')).toBeInTheDocument()
  expect(input).toHaveValue('')
  await user.type(input, 'New draft')
  await act(async () => request.reject(new Error('offline')))
  expect(await within(log).findByText(/send not confirmed/i)).toBeInTheDocument()
  expect(within(log).getByText('Submitted instruction')).toBeInTheDocument()
  expect(input).toHaveValue('New draft')
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
})

it.each(['ACK', 'failure'] as const)('ignores an old %s after closing and reopening the builder with a new send', async (outcome) => {
  const oldAck = deferred<{ job_id: string }>()
  const newAck = deferred<{ job_id: string }>()
  const jobId = '550e8400-e29b-41d4-a716-446655440060'
  vi.mocked(api.startWizardAi).mockReturnValueOnce(oldAck.promise).mockReturnValueOnce(newAck.promise)
  const { user, input } = await resumeChat()
  await user.click(input)
  await user.paste('Old instruction')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(api.startWizardAi).toHaveBeenCalledOnce())
  await user.click(screen.getByRole('button', { name: 'Close builder' }))
  await user.click(await screen.findByRole('button', { name: 'Save and close' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Feedback Builder' })).not.toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: 'Continue previous session' }))
  const nextInput = await screen.findByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' })
  await user.click(nextInput)
  await user.paste('Current instruction')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(api.startWizardAi).toHaveBeenCalledTimes(2))
  await user.click(nextInput)
  await user.paste('New draft')
  await act(async () => {
    if (outcome === 'ACK') oldAck.resolve({ job_id: jobId })
    else oldAck.reject(new Error('Old request failed'))
  })
  expect(api.wizardConversation).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(nextInput).toHaveValue('New draft')
  fireEvent.submit(nextInput.closest('form')!)
  expect(api.startWizardAi).toHaveBeenCalledTimes(2)
}, 10000)

it('does not roll back the completed transcript when the ACK conversation read arrives late', async () => {
  const ackRead = deferred<Awaited<ReturnType<Api['wizardConversation']>>>()
  const jobId = '550e8400-e29b-41d4-a716-446655440060'
  const submitted = { id: '1', role: 'user' as const, content: 'Shorten it', created_at: timestamp }
  vi.mocked(api.startWizardAi).mockResolvedValue({ job_id: jobId })
  vi.mocked(api.job).mockResolvedValue({ id: jobId, status: 'completed', error_code: null, result: null })
  const { user, input, log } = await resumeChat()
  vi.mocked(api.wizardConversation).mockReturnValueOnce(ackRead.promise).mockResolvedValue({ messages: [
    submitted, { id: '2', role: 'assistant', content: 'Updated draft.', created_at: timestamp },
  ] })
  await user.type(input, 'Shorten it')
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await user.type(input, 'Keep this newer draft')
  expect(await within(log).findByText('Updated draft.', {}, { timeout: 3000 })).toBeInTheDocument()
  await act(async () => ackRead.resolve({ messages: [submitted] }))
  expect(within(log).getByText('Updated draft.')).toBeInTheDocument()
  expect(within(log).getAllByText('Shorten it')).toHaveLength(1)
  expect(input).toHaveValue('Keep this newer draft')
})

beforeEach(() => {
  window.localStorage.clear()
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
  vi.mocked(api.wizardPreview).mockResolvedValue({ survey, survey_id: '550e8400-e29b-41d4-a716-446655440040', revision, direct_url: 'feedback.html?id=550e8400-e29b-41d4-a716-446655440040', is_draft: true, completion_certificate_enabled: true, completed_response_download_enabled: false })
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
  expect(within(builder).getByRole('radio', { name: /Individual feedback/ })).not.toBeChecked()
  expect(within(builder).getByRole('radio', { name: /Team feedback/ })).not.toBeChecked()
  await user.click(within(builder).getByRole('radio', { name: /Individual feedback/ }))
  expect(within(builder).getByRole('radio', { name: /Guided feedback/ })).not.toBeChecked()
  await user.click(within(builder).getByRole('radio', { name: /Guided feedback/ }))
  expect(await within(builder).findByRole('button', { name: /Weekly reflection/ })).toHaveAttribute('aria-pressed', 'true')
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await waitFor(() => expect(api.createWizardDraft).toHaveBeenCalledWith(courseId, expect.objectContaining({ template_id: 'weekly-reflection' }), expect.any(String)))
  expect(await within(builder).findByRole('heading', { name: 'Feedback artifact' })).toBeInTheDocument()
  expect(within(builder).getByRole('textbox', { name: 'Feedback title' })).toHaveValue('Weekly reflection')
  expect(within(builder).getByText('Individual · Guided')).toBeInTheDocument()
  await user.click(within(builder).getByRole('button', { name: 'Student introduction' }))
  expect(within(builder).getByRole('textbox', { name: 'Student introduction' })).toBeInTheDocument()
  await user.click(within(builder).getByRole('button', { name: 'Section 1 actions' }))
  expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(within(builder).getByRole('log', { name: 'Conversation' })).toBeInTheDocument()
  expect(within(builder).getByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' })).toBeInTheDocument()
  const composer = within(builder).getByTestId('chat-composer')
  expect(within(composer).getByRole('button', { name: 'Dictate' })).toBeInTheDocument()
  expect(within(composer).getByRole('button', { name: 'Send' })).toHaveClass('chat-composer-send')
  await user.type(within(builder).getByRole('textbox', { name: 'Feedback title' }), ' revised')
  vi.mocked(api.freezeWizardDraft).mockResolvedValue({ revision: { ...revision, body: { ...body, title: 'Weekly reflection revised' } } })
  await user.click(within(builder).getByRole('button', { name: 'Generate preview' }))
  expect(await within(builder).findByRole('heading', { name: 'Preview this exact version' })).toBeInTheDocument()
  expect(within(builder).getByRole('switch', { name: 'Completion certificate' })).toBeChecked()
  expect(within(builder).getByRole('switch', { name: 'Completed response form' })).not.toBeChecked()
  const open = vi.spyOn(window, 'open').mockReturnValue({} as Window)
  await user.click(within(builder).getByRole('button', { name: /Open student preview/ }))
  expect(open).toHaveBeenCalledWith('/feedback.html?id=550e8400-e29b-41d4-a716-446655440040', '_blank')
  open.mockRestore()
  await user.click(await within(builder).findByRole('button', { name: /^Skip$/ }))
  const skipDialog = await screen.findByRole('alertdialog', { name: 'Skip the student preview?' })
  expect(api.decideWizardPreview).not.toHaveBeenCalled()
  await user.click(within(skipDialog).getByRole('button', { name: /^Skip preview$/ }))
  await within(builder).findByRole('heading', { name: 'Publish this feedback' })
  expect(within(builder).getByRole('heading', { name: 'Publish this feedback' })).toBeInTheDocument()
  expect(within(builder).getByRole('textbox', { name: 'Feedback label' })).toHaveValue('Weekly reflection revised')
  expect(within(builder).getByLabelText('Opens (optional)')).toHaveValue('')
  expect(within(builder).getByLabelText('Closes (optional)')).toHaveValue('')
  expect(within(builder).getByText('Blank dates mean available now with no automatic close.')).toBeInTheDocument()
  expect(within(builder).getByText('Certificate on · response form off')).toBeInTheDocument()
  await user.click(within(builder).getByRole('button', { name: 'Publish & get link' }))
  expect(await within(builder).findByRole('alert')).toHaveTextContent('Could not complete this action. Please try again.')
  await user.click(within(builder).getByRole('button', { name: 'Publish & get link' }))
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
  await user.click(within(builder).getByRole('radio', { name: /Individual feedback/ }))
  await user.click(within(builder).getByRole('radio', { name: /Guided feedback/ }))
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
  await user.click(within(builder).getByRole('radio', { name: /Individual feedback/ }))
  await user.click(within(builder).getByRole('radio', { name: /Guided feedback/ }))
  await user.click(await within(builder).findByRole('button', { name: /Weekly reflection/ }))
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await user.type(await within(builder).findByRole('textbox', { name: 'Ask LEAI to edit this feedback draft' }), 'Shorten the introduction')
  await user.click(within(builder).getByRole('button', { name: 'Send' }))
  expect(await within(builder).findByText(/LEAI stopped this draft edit/, {}, { timeout: 3000 })).toBeInTheDocument()
  expect(api.startWizardAi).toHaveBeenCalledTimes(1)
})

it('routes Team straight to its Guided starting point and leaves the prior draft when closing', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Create new feedback' }))
  await user.click(screen.getByRole('radio', { name: /Team feedback/ }))
  expect(screen.getByRole('heading', { name: 'Choose a starting point' })).toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: /Open conversation/ })).not.toBeInTheDocument()
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
  await user.click(within(builder).getByRole('radio', { name: /Individual feedback/ }))
  await user.click(within(builder).getByRole('radio', { name: /Guided feedback/ }))
  await user.click(await within(builder).findByRole('button', { name: /Weekly reflection/ }))
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await within(builder).findByRole('heading', { name: 'Feedback artifact' })
  await user.click(within(builder).getByRole('button', { name: 'Generate preview' }))
  await user.click(await within(builder).findByRole('button', { name: /^Skip$/ }))
  const skipDialog = await screen.findByRole('alertdialog', { name: 'Skip the student preview?' })
  expect(api.decideWizardPreview).not.toHaveBeenCalled()
  await user.click(within(skipDialog).getByRole('button', { name: /^Skip preview$/ }))
  await within(builder).findByRole('heading', { name: 'Publish this feedback' })

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
  await user.click(within(nextBuilder).getByRole('radio', { name: /Individual feedback/ }))
  await user.click(within(nextBuilder).getByRole('radio', { name: /Guided feedback/ }))
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
  await user.click(within(builder).getByRole('radio', { name: /Individual feedback/ }))
  await user.click(within(builder).getByRole('radio', { name: /Guided feedback/ }))
  await user.click(await within(builder).findByRole('button', { name: /Weekly reflection/ }))
  await user.click(within(builder).getByRole('button', { name: /^Continue$/ }))
  await within(builder).findByRole('heading', { name: 'Feedback artifact' })
  await user.click(within(builder).getByRole('button', { name: 'Generate preview' }))
  await user.click(await within(builder).findByRole('button', { name: /^Skip$/ }))
  const skipDialog = await screen.findByRole('alertdialog', { name: 'Skip the student preview?' })
  expect(api.decideWizardPreview).not.toHaveBeenCalled()
  await user.click(within(skipDialog).getByRole('button', { name: /^Skip preview$/ }))
  await within(builder).findByRole('heading', { name: 'Publish this feedback' })
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

it('deletes a draft only after an explicit action and removes its resume card', async () => {
  vi.mocked(api.deleteWizardDraft).mockResolvedValue({ deleted: true })
  vi.mocked(api.wizardDrafts).mockResolvedValueOnce({ question_sets: [draft] }).mockResolvedValue({ question_sets: [] })
  renderPage()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Delete draft' }))
  const dialog = screen.getByRole('alertdialog')
  expect(api.deleteWizardDraft).not.toHaveBeenCalled()
  await user.click(within(dialog).getByRole('button', { name: 'Delete draft' }))
  await waitFor(() => expect(api.deleteWizardDraft).toHaveBeenCalledWith(courseId, draft.id, draft.draft_version))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Continue previous session' })).not.toBeInTheDocument())
})
