import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type {
  AnalysisOverviewResponse,
  AnalysisProgressResponse,
  AnalysisResponse,
  AnalysisResponsesResponse,
} from '@/api/contracts/feedback-analyzer'
import type { CanonicalCourse } from '@/api/contracts/instructor'
import { getEnvironment, qualifyBrowserKey } from '@/config/environment'
import type { FeedbackAnalyzerApi } from './FeedbackAnalyzerPage'
import { FeedbackAnalyzerPage } from './FeedbackAnalyzerPage'

const courseId = '550e8400-e29b-41d4-a716-446655440000'
const environment = getEnvironment({})
const generalOccurrenceId = '550e8400-e29b-41d4-a716-446655440010'
const teamOccurrenceId = '550e8400-e29b-41d4-a716-446655440011'
const responseId = '550e8400-e29b-41d4-a716-446655440020'
const course: CanonicalCourse = {
  course_id: courseId,
  course_code: 'cmpm-80h',
  course_name: 'Game Design',
  institution_slug: 'ucsc',
  lifecycle_state: 'active',
  role: 'owner',
  allowed_actions: ['analysis.use', 'responses.view', 'course.manage'],
}
const metrics = {
  response_count: 1,
  student_turn_count: 2,
  pdf_response_count: 0,
  average_words: 12,
  participation: { state: 'unavailable' as const, reason: 'eligible_denominator_missing' },
  turn_distribution: { state: 'unavailable' as const, reason: 'insufficient_occurrences' },
  question_health: { state: 'unavailable' as const, reason: 'exact_structured_identifiers_unavailable' },
}
const overview: AnalysisOverviewResponse = {
  course: { id: courseId, name: 'Game Design' },
  selected_occurrence_ids: [generalOccurrenceId, teamOccurrenceId],
  occurrences: [
    {
      id: generalOccurrenceId,
      label: 'Week 1 feedback',
      mode: 'general',
      audience: 'individual',
      collection_style: 'open',
      completion_certificate_enabled: false,
      schema_family_id: generalOccurrenceId,
      created_at: '2026-09-27T12:00:00Z',
      metrics,
    },
    {
      id: teamOccurrenceId,
      label: 'Week 1 team feedback',
      mode: 'team',
      audience: 'team',
      collection_style: 'guided',
      completion_certificate_enabled: false,
      schema_family_id: teamOccurrenceId,
      created_at: '2026-09-27T12:10:00Z',
      metrics: { ...metrics, response_count: 1, student_turn_count: 0 },
    },
  ],
  summary: metrics,
  team_surveys: [{
    id: teamOccurrenceId,
    label: 'Week 1 team feedback',
    configuration_label: 'Project teams',
    teams: [{ id: '17', label: 'Red', response_count: 0 }],
    unlinked_response_count: 1,
  }],
}
const responses: AnalysisResponsesResponse = {
  results: [{
    kind: 'chat',
    response_id: responseId,
    label: 'R1',
    survey_label: 'Week 1 feedback',
    created_at: '2026-09-27T12:20:00Z',
    nudged: false,
    response_href: '#response=' + responseId,
    transcript: [{ message_id: 'm1', content: 'The weekly instructions were clear.', timestamp: '2026-09-27T12:20:00Z' }],
    answers: [],
    occurrence_id: generalOccurrenceId,
    team_snapshot_id: null,
    team_snapshot_item_id: null,
    team_label: null,
    team_configuration_label: null,
    source: 'student',
  }],
  has_more: false,
  next_cursor: null,
}
const matchingResponses: AnalysisResponsesResponse = {
  results: [{
    ...responses.results[0],
    response_id: '550e8400-e29b-41d4-a716-446655440030',
    label: 'R2',
    transcript: [{ message_id: 'm2', content: 'Clear, instructions helped.', timestamp: '2026-09-27T12:21:00Z' }],
  }],
  has_more: false,
  next_cursor: null,
}
const progress: AnalysisProgressResponse = {
  state: 'available',
  occurrences: [{ id: generalOccurrenceId, label: 'Week 1 feedback' }],
  students: [{ label: 'S1', match_confidence: 'high', responses_by_occurrence: { [generalOccurrenceId]: 1 } }],
  groups: [],
  unlinked_by_occurrence: [],
}
const api: FeedbackAnalyzerApi = {
  courses: vi.fn(),
  overview: vi.fn(),
  responses: vi.fn(),
  responseDetail: vi.fn(),
  verifyCertificates: vi.fn(),
  ngrams: vi.fn(),
  search: vi.fn(),
  progress: vi.fn(),
}

function renderPage(verified = true, pageApi: FeedbackAnalyzerApi = api) {
  sessionStorage.setItem(qualifyBrowserKey(environment.name, 'selected-course'), courseId)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><FeedbackAnalyzerPage api={pageApi} environment={environment} verified={verified} /></QueryClientProvider>)
  return client
}

beforeEach(() => {
  sessionStorage.clear()
  window.history.replaceState(null, '', '/FeedbackAnalyzer.html')
  vi.mocked(api.courses).mockReset().mockResolvedValue({ courses: [course] })
  vi.mocked(api.overview).mockReset().mockResolvedValue(overview)
  vi.mocked(api.responses).mockReset().mockResolvedValue(responses)
  vi.mocked(api.responseDetail).mockReset().mockResolvedValue({
    ...responses.results[0],
    transcript: [{ message_id: '55', content: 'The cited source message.', timestamp: '2026-09-27T12:20:00Z' }],
  } satisfies AnalysisResponse)
  vi.mocked(api.verifyCertificates).mockReset().mockResolvedValue({ results: [] })
  vi.mocked(api.ngrams).mockReset().mockResolvedValue({
    source_count: 1,
    cutoff_at: '2026-09-27T12:20:00Z',
    keyness_available: false,
    items: [{ term: 'clear instructions', count: 1, keyness: null }],
  })
  vi.mocked(api.search).mockReset().mockResolvedValue({ query: 'clear', results: [], has_more: false })
  vi.mocked(api.progress).mockReset().mockResolvedValue(progress)
})

it('loads course analysis and composes response records using the existing presentation components', async () => {
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByRole('button', { name: 'Week 1 feedback' })).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Course' })).not.toBeInTheDocument()
  const modeTabs = await screen.findByRole('tablist', { name: 'Survey mode' })
  await screen.findByRole('tab', { name: 'Student progress' })
  expect(within(modeTabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'General Course Feedback',
    'In-Group Feedback',
    'Structured Reflection',
    'Student progress',
  ])
  expect(screen.getByRole('navigation', { name: 'Survey week scope' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Analysis metrics' })).toBeInTheDocument()
  expect(await screen.findByText('The weekly instructions were clear.')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getByText(/Participation unavailable:/)).toBeInTheDocument()
  expect(screen.getByText('Instructor Insights are unavailable until an approved provider is configured.')).toBeInTheDocument()
  expect(api.overview).toHaveBeenCalledWith(courseId, expect.any(Array), expect.any(AbortSignal))
  await user.click(screen.getByText('R1'))
  const responseLink = screen.getByRole('link', { name: 'Open response R1' })
  expect(responseLink).toHaveAttribute('href', expect.stringContaining(`/FeedbackAnalyzer.html?course_id=${courseId}`))
  expect(responseLink).toHaveAttribute('href', expect.stringContaining(`occurrence_id=${generalOccurrenceId}`))
  expect(responseLink).toHaveAttribute('href', expect.stringContaining(`response_id=${responseId}`))
})

it('hides progress tabs when anonymous matching is unavailable', async () => {
  vi.mocked(api.progress).mockResolvedValueOnce({ state: 'unavailable', reason: 'matching_disabled', occurrences: [], students: [], groups: [], unlinked_by_occurrence: [] })
  const client = renderPage()
  await screen.findByRole('button', { name: 'Week 1 feedback' })
  await waitFor(() => expect(client.getQueryState(['feedback-analyzer-progress', courseId])?.status).toBe('success'))
  const tabs = screen.getByRole('tablist', { name: 'Survey mode' })
  expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'General Course Feedback', 'In-Group Feedback', 'Structured Reflection',
  ])
})

it('exposes anonymous progress only when selected', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('tab', { name: 'Student progress' })
  await user.click(screen.getByRole('tab', { name: 'Student progress' }))
  expect(await screen.findByText('Anonymous labels and match confidence only.')).toBeInTheDocument()
  expect(screen.getByRole('row', { name: /S1/ })).toBeInTheDocument()
  expect(api.progress).toHaveBeenCalledWith(courseId, expect.any(Array), expect.any(AbortSignal))
})

it('loads n-grams and retrieves scoped response records when a term is selected', async () => {
  const user = userEvent.setup()
  const ngrams = vi.fn().mockResolvedValue({
    source_count: 1,
    cutoff_at: '2026-09-27T12:20:00Z',
    keyness_available: false,
    items: [{ term: 'clear instructions', count: 1, keyness: null }],
  })
  const pageApi = { ...api, ngrams }
  vi.mocked(api.responses).mockImplementation(async (_courseId, request) => request.term ? matchingResponses : responses)

  renderPage(true, pageApi)
  await screen.findByRole('table', { name: 'N-gram terms' })
  await user.click(await screen.findByRole('button', { name: 'clear instructions' }))

  expect(ngrams).toHaveBeenCalledWith(courseId, expect.any(Array), 1, expect.any(AbortSignal))
  expect(api.responses).toHaveBeenCalledWith(courseId, expect.objectContaining({ term: 'clear instructions' }), expect.any(AbortSignal))
  expect(await screen.findByText('Clear, instructions helped.')).toBeInTheDocument()
})

it('embeds the existing bounded course-wide response search', async () => {
  const user = userEvent.setup()
  const search = vi.fn().mockResolvedValue({
    query: 'clear',
    results: [{
      message_id: 55,
      response_id: responseId,
      occurrence_label: 'Week 1 feedback',
      excerpt: 'The weekly instructions were clear.',
      created_at: '2026-09-27T12:20:00Z',
    }],
    has_more: false,
  })
  const pageApi = { ...api, search }

  renderPage(true, pageApi)
  await user.type(await screen.findByRole('searchbox', { name: 'Search course responses' }), 'clear')
  await user.click(screen.getByRole('button', { name: 'Search course responses' }))

  expect(search).toHaveBeenCalledWith(courseId, 'clear', expect.any(AbortSignal))
  const searchResults = await screen.findByRole('region', { name: 'Course response search results' })
  expect(within(searchResults).getByText('The weekly instructions were clear.')).toBeInTheDocument()
  expect(screen.getByText('Search covers completed responses across all surveys.')).toBeInTheDocument()
})

it('keeps unlinked team response details visible without placing them under a team', async () => {
  const user = userEvent.setup()
  const unlinked: AnalysisResponsesResponse = {
    results: [{
      ...responses.results[0],
      response_id: '550e8400-e29b-41d4-a716-446655440021',
      label: 'R2',
      survey_label: 'Week 1 team feedback',
      occurrence_id: teamOccurrenceId,
      team_snapshot_id: null,
      team_snapshot_item_id: null,
      team_label: null,
      team_configuration_label: null,
      transcript: [{ message_id: 'm2', content: 'We were not assigned to a team.', timestamp: '2026-09-27T12:22:00Z' }],
    }],
    has_more: false,
    next_cursor: null,
  }
  vi.mocked(api.responses).mockImplementation(async (_courseId, request) => request.unlinkedOccurrenceId ? unlinked : responses)
  renderPage()
  const teamTab = await screen.findByRole('tab', { name: 'In-Group Feedback' })
  await user.click(teamTab)
  expect(await screen.findByRole('region', { name: 'Unlinked response records' })).toBeInTheDocument()
  expect(await screen.findByText('We were not assigned to a team.')).toBeInTheDocument()
  expect(screen.getByRole('row', { name: /Red/ })).toHaveTextContent('0')
})

it('loads every page of a team response drill-down', async () => {
  const user = userEvent.setup()
  const firstPage: AnalysisResponsesResponse = {
    results: [{
      ...responses.results[0],
      occurrence_id: teamOccurrenceId,
      team_snapshot_id: 'snapshot-1',
      team_snapshot_item_id: '17',
      team_label: 'Red',
      team_configuration_label: 'Project teams',
      transcript: [{ message_id: 'team-1', content: 'First team response.', timestamp: '2026-09-27T12:20:00Z' }],
    }],
    has_more: true,
    next_cursor: 'team-cursor-1',
  }
  const secondPage: AnalysisResponsesResponse = {
    results: [{
      ...firstPage.results[0],
      response_id: '550e8400-e29b-41d4-a716-446655440031',
      label: 'R3',
      transcript: [{ message_id: 'team-2', content: 'Second team response.', timestamp: '2026-09-27T12:21:00Z' }],
    }],
    has_more: false,
    next_cursor: null,
  }
  const pageApi = {
    ...api,
    overview: vi.fn().mockResolvedValue({
      ...overview,
      team_surveys: [{
        ...overview.team_surveys[0],
        teams: [{ ...overview.team_surveys[0].teams[0], response_count: 2 }],
      }],
    }),
    responses: vi.fn(async (_courseId: string, request: { teamSnapshotItemId?: string; unlinkedOccurrenceId?: string; cursor?: string }) => {
      if (request.unlinkedOccurrenceId) return { results: [], has_more: false, next_cursor: null }
      if (request.teamSnapshotItemId) return request.cursor ? secondPage : firstPage
      return responses
    }),
  }

  renderPage(true, pageApi)
  await user.click(await screen.findByRole('tab', { name: 'In-Group Feedback' }))
  await user.click(await screen.findByRole('button', { name: 'View Red' }))
  expect(await screen.findByText('First team response.')).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: 'Load more team responses' }))
  expect(await screen.findByText('Second team response.')).toBeInTheDocument()
})

it('does not load protected course data before identity verification', () => {
  renderPage(false)
  expect(screen.getByText('Waiting for backend identity verification before opening instructor feedback.')).toBeInTheDocument()
  expect(api.courses).not.toHaveBeenCalled()
  expect(api.overview).not.toHaveBeenCalled()
})

it('opens the exact cited response and source message from a Feedback Chat deep link', async () => {
  window.history.replaceState(null, '', `/FeedbackAnalyzer.html?course_id=${courseId}&occurrence_id=${generalOccurrenceId}&response_id=${responseId}&response_message_id=55`)
  const responseDetail = vi.fn().mockResolvedValue({
    ...responses.results[0],
    transcript: [{ message_id: '55', content: 'The cited source message.', timestamp: '2026-09-27T12:20:00Z' }],
  })
  const pageApi = { ...api, responseDetail }

  renderPage(true, pageApi)

  expect(await screen.findByRole('region', { name: 'Linked feedback response' })).toBeInTheDocument()
  expect(await screen.findByText('The cited source message.')).toBeInTheDocument()
  expect(responseDetail).toHaveBeenCalledWith(courseId, responseId, expect.any(AbortSignal))
  expect(document.getElementById('response-message-55')).toBeInTheDocument()
})

it('verifies certificate codes only for an enabled individual survey week', async () => {
  const user = userEvent.setup()
  const verifyCertificates = vi.fn().mockResolvedValue({ results: [true, false] })
  const enabledOverview: AnalysisOverviewResponse = {
    ...overview,
    occurrences: overview.occurrences.map((occurrence) => occurrence.id === generalOccurrenceId
      ? { ...occurrence, completion_certificate_enabled: true }
      : occurrence),
  }
  const pageApi = {
    ...api,
    overview: vi.fn().mockResolvedValue(enabledOverview),
    verifyCertificates,
  }

  renderPage(true, pageApi)
  await screen.findByRole('button', { name: 'Week 1 feedback' })
  expect(screen.queryByText('Verify completion certificates')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Week 1 feedback' }))
  await user.type(screen.getByRole('textbox', { name: /Paste codes to verify/ }), 'ABCD-EFGH, JKLM-NPQR')
  await user.click(screen.getByRole('button', { name: 'Verify certificates' }))

  expect(verifyCertificates).toHaveBeenCalledWith(courseId, {
    occurrence_id: generalOccurrenceId,
    codes: ['ABCD-EFGH', 'JKLM-NPQR'],
  })
  const resultTable = await screen.findByRole('table', { name: 'Certificate verification results' })
  expect(within(resultTable).getByText('ABCD-EFGH')).toBeInTheDocument()
  expect(within(resultTable).getByText('Valid')).toBeInTheDocument()
  expect(within(resultTable).getByText('Not Found')).toBeInTheDocument()
})

it('keeps certificate verification hidden for all-week, disabled, and team scopes', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Week 1 feedback' }))
  expect(screen.queryByText('Verify completion certificates')).not.toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: 'In-Group Feedback' }))
  expect(screen.queryByText('Verify completion certificates')).not.toBeInTheDocument()
})
