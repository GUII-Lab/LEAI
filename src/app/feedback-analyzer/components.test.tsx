import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import {
  AnalysisModeTabs,
  CertificateVerification,
  InstructorInsightsCard,
  MetricCards,
  NgramPanel,
  PdfImportPanel,
  ProgressTables,
  ResponseList,
  type AnalyzerResponse,
  type ResponseSourceFilter,
  TeamSurveyPanel,
  WeekScopeChips,
} from './components'

const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
beforeAll(() => { Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: () => undefined }) })
afterAll(() => {
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

const responseFixtures: readonly AnalyzerResponse[] = [
  {
    kind: 'chat', responseId: 'response-1', label: 'R1', surveyLabel: 'Week 4 Reflection',
    createdAt: '2026-09-25T11:00:00Z', nudged: true,
    responseHref: '/courses/c1/responses/response-1',
    transcript: [{ messageId: 'm1', content: 'The project brief was clear.' }],
  },
  {
    kind: 'pdf', responseId: 'response-2', label: 'R2', surveyLabel: 'Week 4 Reflection',
    createdAt: '2026-09-25T12:00:00Z', nudged: false,
    responseHref: '/courses/c1/responses/response-2',
    answers: [{ answerId: 'a1', question: 'What was useful?', value: 'Peer feedback.' }],
  },
]

function InteractiveResponseList({ onSourceFilterChange, onNudgedOnlyChange }: {
  onSourceFilterChange: (source: ResponseSourceFilter) => void
  onNudgedOnlyChange: (nudgedOnly: boolean) => void
}) {
  const [sourceFilter, setSourceFilter] = useState<ResponseSourceFilter>('all')
  const [nudgedOnly, setNudgedOnly] = useState(false)
  return <ResponseList
    responses={responseFixtures}
    sourceFilter={sourceFilter}
    onSourceFilterChange={(source) => { onSourceFilterChange(source); setSourceFilter(source) }}
    nudgedOnly={nudgedOnly}
    onNudgedOnlyChange={(value) => { onNudgedOnlyChange(value); setNudgedOnly(value) }}
    state={{ status: 'ready' }}
  />
}

it('changes the analysis mode through accessible tabs', async () => {
  const user = userEvent.setup()
  const onModeChange = vi.fn()
  render(<AnalysisModeTabs mode="general" onModeChange={onModeChange} />)

  await user.click(screen.getByRole('tab', { name: 'Structured Reflection' }))
  expect(onModeChange).toHaveBeenCalledWith('structured')
})

it('selects a course week without changing the other available scopes', async () => {
  const user = userEvent.setup()
  const onScopeChange = vi.fn()
  render(<WeekScopeChips
    scopes={[{ id: 'all', label: 'All weeks' }, { id: 'occ-4', label: 'Week 4 Reflection' }]}
    selectedScopeId="all"
    onScopeChange={onScopeChange}
  />)

  await user.click(screen.getByRole('button', { name: 'Week 4 Reflection' }))
  expect(onScopeChange).toHaveBeenCalledWith('occ-4')
  expect(screen.getByRole('button', { name: 'All weeks' })).toHaveAttribute('aria-pressed', 'true')
})

it('does not render a participation percentage without a valid denominator', () => {
  render(<MetricCards metrics={{
    responseCount: 3,
    studentTurnCount: 7,
    averageWordsPerResponse: 42,
    participation: { status: 'unavailable', reason: 'Eligible participant count is unavailable.' },
  }} />)

  expect(screen.getByText('3')).toBeInTheDocument()
  expect(screen.getByText('7')).toBeInTheDocument()
  expect(screen.getByText(/Participation unavailable:/)).toBeInTheDocument()
  expect(screen.getByText(/Eligible participant count is unavailable/)).toBeInTheDocument()
  expect(screen.queryByText(/%/)).not.toBeInTheDocument()
})

it('shows participation only when the participant numerator fits its eligible denominator', () => {
  const { rerender } = render(<MetricCards metrics={{
    responseCount: 2,
    studentTurnCount: 3,
    averageWordsPerResponse: null,
    participation: { status: 'available', participantCount: 2, eligibleParticipantCount: 4 },
  }} />)
  expect(screen.getByText('50%')).toBeInTheDocument()
  rerender(<MetricCards metrics={{
    responseCount: 2,
    studentTurnCount: 3,
    averageWordsPerResponse: null,
    participation: { status: 'available', participantCount: 5, eligibleParticipantCount: 4 },
  }} />)
  expect(screen.getByText('An eligible participant denominator is required.')).toBeInTheDocument()
  expect(screen.queryByText(/%/)).not.toBeInTheDocument()
})

it('preserves n-gram size and keyness controls with cutoff metadata and retryable failures', async () => {
  const user = userEvent.setup()
  const onNgramSizeChange = vi.fn()
  const onSortChange = vi.fn()
  const ready = render(<NgramPanel
    state={{
      status: 'ready', sourceCount: 12, cutoffAt: '2026-09-26T12:00:00Z', keynessAvailable: true,
      items: [{ term: 'peer review', count: 4, keyness: 2.6 }],
    }}
    ngramSize={1}
    sort="frequency"
    onNgramSizeChange={onNgramSizeChange}
    onSortChange={onSortChange}
  />)
  expect(screen.getByText(/12 responses/)).toBeInTheDocument()
  expect(screen.getByText('2026-09-26T12:00:00Z')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Bigram' }))
  await user.click(screen.getByRole('button', { name: 'Keyness' }))
  expect(onNgramSizeChange).toHaveBeenCalledWith(2)
  expect(onSortChange).toHaveBeenCalledWith('keyness')
  ready.unmount()

  const onRetry = vi.fn()
  render(<NgramPanel
    state={{ status: 'error', message: 'N-gram analysis is temporarily unavailable.', retryable: true }}
    ngramSize={1}
    sort="frequency"
    onNgramSizeChange={onNgramSizeChange}
    onSortChange={onSortChange}
    onRetry={onRetry}
  />)
  await user.click(screen.getByRole('button', { name: 'Retry n-gram analysis' }))
  expect(onRetry).toHaveBeenCalledOnce()
})

it('opens matching response records when an instructor selects an n-gram term', async () => {
  const user = userEvent.setup()
  const onTermSelect = vi.fn()
  const panelProps = {
    state: {
      status: 'ready' as const,
      sourceCount: 2,
      cutoffAt: '2026-09-27T12:00:00Z',
      keynessAvailable: true,
      items: [{ term: 'clear instructions', count: 2, keyness: 1.8 }],
    },
    ngramSize: 2 as const,
    sort: 'frequency' as const,
    onNgramSizeChange: vi.fn(),
    onSortChange: vi.fn(),
    onTermSelect,
  }

  render(<NgramPanel {...panelProps} />)
  await user.click(screen.getByRole('button', { name: 'clear instructions' }))

  expect(onTermSelect).toHaveBeenCalledWith('clear instructions')
})

it('keeps ordinary Analyzer table headings at the regular text scale', () => {
  render(<NgramPanel
    state={{ status: 'ready', sourceCount: 1, cutoffAt: null, keynessAvailable: false, items: [{ term: 'clear', count: 1, keyness: null }] }}
    ngramSize={1}
    sort="frequency"
    onNgramSizeChange={vi.fn()}
    onSortChange={vi.fn()}
  />)

  expect(within(screen.getByRole('table', { name: 'N-gram terms' })).getByRole('row', { name: 'Term Frequency' })).toHaveClass('text-base')
})

it('opens an insight citation with its exact response source', async () => {
  const user = userEvent.setup()
  const onCitationOpen = vi.fn()
  render(<InstructorInsightsCard
    state={{
      status: 'ready',
      sourceCount: 8,
      responseCutoff: '2026-09-25T18:00:00Z',
      generatedAt: '2026-09-25T18:02:00Z',
      stale: false,
      claims: [{
        id: 'theme-1',
        text: 'Students valued making something tangible.',
        supportingResponseCount: 3,
        citations: [{
          label: 'R4',
          responseId: 'response-exact-4',
          sourceLabel: 'Week 4 Reflection',
          excerpt: 'I liked seeing the prototype come together.',
          href: '/courses/course-1/responses/response-exact-4',
        }],
      }],
    }}
    onGenerate={vi.fn()}
    onCitationOpen={onCitationOpen}
  />)

  await user.click(screen.getByRole('button', { name: 'Open source R4' }))
  expect(await screen.findByText('“I liked seeing the prototype come together.”')).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Sources for: Students valued making something tangible.' })).toBeInTheDocument()
  const sourceLink = screen.getByRole('link', { name: /Open response R4/ })
  expect(sourceLink).toHaveAttribute('href', '/courses/course-1/responses/response-exact-4')
  await user.click(screen.getByRole('link', { name: 'Open response R4' }))
  expect(onCitationOpen).toHaveBeenCalledWith('response-exact-4')
})

it('shows stale, pending, and retryable insight states', async () => {
  const user = userEvent.setup()
  const onRetry = vi.fn()
  const pending = render(<InstructorInsightsCard
    state={{ status: 'pending', sourceCount: 5, responseCutoff: '2026-09-26T12:00:00Z' }}
    onGenerate={vi.fn()}
    onRetry={onRetry}
  />)
  expect(screen.getByRole('status')).toHaveTextContent('Generating Instructor Insights')
  expect(screen.getByRole('status')).toHaveTextContent('5 responses')
  pending.unmount()

  const failed = render(<InstructorInsightsCard
    state={{ status: 'error', message: 'The analysis could not finish.', retryable: true }}
    onGenerate={vi.fn()}
    onRetry={onRetry}
  />)
  await user.click(screen.getByRole('button', { name: 'Retry Instructor Insights' }))
  expect(onRetry).toHaveBeenCalledOnce()
  failed.unmount()

  render(<InstructorInsightsCard
    state={{
      status: 'ready',
      sourceCount: 5,
      responseCutoff: '2026-09-26T12:00:00Z',
      generatedAt: '2026-09-26T12:01:00Z',
      stale: true,
      staleResponseCount: 2,
      claims: [],
    }}
    onGenerate={vi.fn()}
  />)
  expect(screen.getByRole('status')).toHaveTextContent('2 new responses')
})

it('filters response cards by source and nudged state and drills into student turns', async () => {
  const user = userEvent.setup()
  const onSourceFilterChange = vi.fn()
  const onNudgedOnlyChange = vi.fn()
  render(<InteractiveResponseList onSourceFilterChange={onSourceFilterChange} onNudgedOnlyChange={onNudgedOnlyChange} />)

  const sourceSelect = screen.getByRole('combobox', { name: 'Response source' })
  await user.tab()
  expect(screen.getByRole('button', { name: 'Expand All' })).toHaveFocus()
  await user.tab()
  expect(sourceSelect).toHaveFocus()
  await user.keyboard('{Enter}{End}{Enter}')
  expect(onSourceFilterChange).toHaveBeenCalledWith('pdf')
  expect(screen.queryByText('R1')).not.toBeInTheDocument()
  expect(screen.getByText('R2')).toBeInTheDocument()

  await user.keyboard('{Enter}{Home}{Enter}')
  expect(onSourceFilterChange).toHaveBeenLastCalledWith('all')
  await user.click(screen.getByRole('switch', { name: 'Nudged only' }))
  expect(onNudgedOnlyChange).toHaveBeenCalledWith(true)
  await user.click(screen.getByText('R1'))
  expect(screen.getByRole('log', { name: 'Conversation' })).toBeInTheDocument()
  expect(screen.getByText('The project brief was clear.')).toBeInTheDocument()
  expect(screen.queryByText('Peer feedback.')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open response R1' })).toHaveAttribute('href', '/courses/c1/responses/response-1')
})

it('expands and collapses all visible response cards while keeping individual control', async () => {
  const user = userEvent.setup()
  render(<InteractiveResponseList onSourceFilterChange={vi.fn()} onNudgedOnlyChange={vi.fn()} />)
  const r1 = screen.getByLabelText('Show response R1').closest('details')
  const r2 = screen.getByLabelText('Show response R2').closest('details')
  expect(r1).not.toHaveAttribute('open')
  expect(r2).not.toHaveAttribute('open')
  await user.click(screen.getByRole('button', { name: 'Expand All' }))
  await waitFor(() => {
    expect(r1).toHaveAttribute('open')
    expect(r2).toHaveAttribute('open')
  })
  await user.click(screen.getByRole('button', { name: 'Collapse All' }))
  await waitFor(() => {
    expect(r1).not.toHaveAttribute('open')
    expect(r2).not.toHaveAttribute('open')
  })
  await user.click(screen.getByLabelText('Show response R1'))
  await waitFor(() => {
    expect(r1).toHaveAttribute('open')
    expect(r2).not.toHaveAttribute('open')
  })
})

it('shows PDF-only answer rows and filtered empty states', async () => {
  const user = userEvent.setup()
  const pdfOnly = render(<ResponseList
    responses={[{
      kind: 'pdf', responseId: 'pdf-response', label: 'R9', surveyLabel: 'Week 9', nudged: false,
      responseHref: '/responses/pdf-response', answers: [{ answerId: 'answer-1', question: 'Prompt', value: 'PDF answer.' }],
    }]}
    sourceFilter="all"
    onSourceFilterChange={vi.fn()}
    nudgedOnly={false}
    onNudgedOnlyChange={vi.fn()}
    state={{ status: 'ready' }}
  />)
  await user.click(screen.getByText('R9'))
  expect(screen.getByText('PDF answer.')).toBeInTheDocument()
  pdfOnly.unmount()

  render(<ResponseList
    responses={[]}
    sourceFilter="all"
    onSourceFilterChange={vi.fn()}
    nudgedOnly
    onNudgedOnlyChange={vi.fn()}
    state={{ status: 'ready' }}
  />)
  expect(screen.getByText('No nudged responses in this scope.')).toBeInTheDocument()
})

it('selects PDF files and exposes commit, revert, and parsed answer states', async () => {
  const user = userEvent.setup()
  const onFilesSelected = vi.fn()
  const onCommit = vi.fn()
  const onRevert = vi.fn()
  render(<PdfImportPanel
    mode="structured"
    onFilesSelected={onFilesSelected}
    batches={[
      { id: 'batch-ready', label: 'Week 4 upload', status: 'ready', fileCount: 2 },
      { id: 'batch-committed', label: 'Week 3 upload', status: 'committed', fileCount: 1 },
    ]}
    batchListState="ready"
    parsedAnswers={{ status: 'ready', answers: [] }}
    onCommit={onCommit}
    onRevert={onRevert}
  />)

  const file = new File(['synthetic reflection'], 'reflection.pdf', { type: 'application/pdf' })
  await user.upload(screen.getByLabelText('Choose PDF reflections'), file)
  expect(onFilesSelected).toHaveBeenCalledWith([file])
  expect(screen.getByText('No parsed answers for this import yet.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Commit Week 4 upload' }))
  await user.click(screen.getByRole('button', { name: 'Revert Week 3 upload' }))
  expect(onCommit).toHaveBeenCalledWith('batch-ready')
  expect(onRevert).toHaveBeenCalledWith('batch-committed')
})

it('rejects a PDF over 10 MiB before starting an import', async () => {
  const user = userEvent.setup()
  const onFilesSelected = vi.fn()
  render(<PdfImportPanel
    mode="structured" onFilesSelected={onFilesSelected} batches={[]} batchListState="ready"
    parsedAnswers={{ status: 'idle' }} onCommit={vi.fn()} onRevert={vi.fn()}
  />)
  const file = new File(['x'], 'large.pdf', { type: 'application/pdf' })
  Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 })

  await user.upload(screen.getByLabelText('Choose PDF reflections'), file)

  expect(screen.getByRole('alert')).toHaveTextContent('Each PDF must be 10 MiB or smaller.')
  expect(onFilesSelected).not.toHaveBeenCalled()
})

it('rejects more than 50 PDFs before starting an import', async () => {
  const user = userEvent.setup()
  const onFilesSelected = vi.fn()
  render(<PdfImportPanel
    mode="structured" onFilesSelected={onFilesSelected} batches={[]} batchListState="ready"
    parsedAnswers={{ status: 'idle' }} onCommit={vi.fn()} onRevert={vi.fn()}
  />)
  const files = Array.from({ length: 51 }, (_, index) => new File(['x'], `${index}.pdf`, { type: 'application/pdf' }))

  await user.upload(screen.getByLabelText('Choose PDF reflections'), files)

  expect(screen.getByRole('alert')).toHaveTextContent('A batch can include at most 50 PDF files.')
  expect(onFilesSelected).not.toHaveBeenCalled()
})

it('rejects a batch over 50 MiB even when each PDF is under its individual limit', async () => {
  const user = userEvent.setup()
  const onFilesSelected = vi.fn()
  render(<PdfImportPanel
    mode="structured" onFilesSelected={onFilesSelected} batches={[]} batchListState="ready"
    parsedAnswers={{ status: 'idle' }} onCommit={vi.fn()} onRevert={vi.fn()}
  />)
  const files = Array.from({ length: 6 }, (_, index) => {
    const file = new File(['x'], `${index}.pdf`, { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 9 * 1024 * 1024 })
    return file
  })

  await user.upload(screen.getByLabelText('Choose PDF reflections'), files)

  expect(screen.getByRole('alert')).toHaveTextContent('A batch can total no more than 50 MiB.')
  expect(onFilesSelected).not.toHaveBeenCalled()
})

it('explains unavailable and failed parsed-answer states and keeps team PDF unsupported', async () => {
  const unavailable = render(<PdfImportPanel
    mode="structured" onFilesSelected={vi.fn()} batches={[]} batchListState="ready"
    parsedAnswers={{ status: 'unavailable', message: 'Parsed answers are unavailable.' }}
    onCommit={vi.fn()} onRevert={vi.fn()}
  />)
  expect(screen.getByText('Parsed answers are unavailable.')).toBeInTheDocument()
  unavailable.unmount()

  const failed = render(<PdfImportPanel
    mode="structured" onFilesSelected={vi.fn()} batches={[]} batchListState="ready"
    parsedAnswers={{ status: 'error', message: 'Could not load parsed answers.' }}
    onCommit={vi.fn()} onRevert={vi.fn()}
  />)
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load parsed answers.')
  failed.unmount()

  render(<PdfImportPanel mode="team" />)
  expect(screen.getByText(/Team PDF import is not supported/)).toBeInTheDocument()
  expect(screen.queryByLabelText('Choose PDF reflections')).not.toBeInTheDocument()
})

it('shows recent PDF batch lifecycle states without enabling unsupported actions', () => {
  render(<PdfImportPanel
    mode="structured" onFilesSelected={vi.fn()}
    batches={[
      { id: 'queued', label: 'Queued upload', status: 'queued', fileCount: 1 },
      { id: 'processing', label: 'Processing upload', status: 'processing', fileCount: 2 },
      { id: 'failed', label: 'Failed upload', status: 'failed', fileCount: 1 },
      { id: 'reverted', label: 'Reverted upload', status: 'reverted', fileCount: 1 },
    ]}
    batchListState="ready"
    parsedAnswers={{ status: 'loading' }}
    onCommit={vi.fn()} onRevert={vi.fn()}
  />)

  expect(screen.getByText(/Queued upload/)).toBeInTheDocument()
  expect(screen.getByText(/Processing upload/)).toBeInTheDocument()
  expect(screen.getByText(/Failed upload/)).toBeInTheDocument()
  expect(screen.getByText(/Reverted upload/)).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Loading parsed answers')
  expect(screen.queryByRole('button', { name: /Commit (Queued|Processing|Failed|Reverted)/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Revert (Queued|Processing|Failed|Reverted)/ })).not.toBeInTheDocument()
})

it('shows an explicit empty state for courses without team surveys', () => {
  render(<TeamSurveyPanel state={{ status: 'ready', surveys: [] }} onSurveyChange={vi.fn()} onTeamChange={vi.fn()} />)
  expect(screen.getByText('No In-Group surveys for this course yet.')).toBeInTheDocument()
})

it('keeps unlinked team responses visible and unassigned while using selection callbacks', async () => {
  const user = userEvent.setup()
  const onSurveyChange = vi.fn()
  const onTeamChange = vi.fn()
  const makeSurvey = (id: string, label: string) => ({
    id,
    label,
    configurationLabel: 'Team setup A',
    teams: [{
      id: 'team-1', label: 'Studio', responseCount: 1,
      responses: [{
        kind: 'chat' as const, responseId: 'assigned-1', label: 'R1', surveyLabel: label, nudged: false,
        responseHref: '/responses/assigned-1', transcript: [{ messageId: 'm1', content: 'Assigned to Studio.' }],
      }],
    }],
    unlinkedResponseCount: 2,
    unlinkedResponses: [
      { kind: 'pdf' as const, responseId: 'unlinked-1', label: 'U1', surveyLabel: label, nudged: false, responseHref: '/responses/unlinked-1', answers: [{ answerId: 'a1', question: 'Reflection', value: 'Unlinked answer one.' }] },
      { kind: 'chat' as const, responseId: 'unlinked-2', label: 'U2', surveyLabel: label, nudged: false, responseHref: '/responses/unlinked-2', transcript: [{ messageId: 'm2', content: 'Unlinked answer two.' }] },
    ],
  })
  render(<TeamSurveyPanel
    state={{ status: 'ready', surveys: [makeSurvey('survey-1', 'Week 4'), makeSurvey('survey-2', 'Week 5')] }}
    selectedSurveyId="missing-survey"
    selectedTeamId="team-1"
    onSurveyChange={onSurveyChange}
    onTeamChange={onTeamChange}
  />)

  expect(screen.getByRole('button', { name: 'Week 4' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('row', { name: /Unlinked responses/ })).toHaveTextContent('2')
  const unlinkedRegion = screen.getByRole('region', { name: 'Unlinked response records' })
  expect(within(unlinkedRegion).getByText('U1')).toBeInTheDocument()
  expect(within(unlinkedRegion).getByText('U2')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Responses for Studio' })).toHaveTextContent('Assigned to Studio.')
  expect(screen.getByRole('region', { name: 'Responses for Studio' })).not.toHaveTextContent('Unlinked answer one.')

  await user.click(screen.getByRole('button', { name: 'Week 5' }))
  await user.click(screen.getByRole('button', { name: 'View Studio' }))
  expect(onSurveyChange).toHaveBeenCalledWith('survey-2')
  expect(onTeamChange).toHaveBeenCalledWith('team-1')
})

it('distinguishes an unlinked response count from response details that were not returned', () => {
  render(<TeamSurveyPanel
    state={{
      status: 'ready',
      surveys: [{
        id: 'survey-1', label: 'Week 4', configurationLabel: 'Team setup A', teams: [],
        unlinkedResponseCount: 3, unlinkedResponses: [],
      }],
    }}
    onSurveyChange={vi.fn()}
    onTeamChange={vi.fn()}
  />)

  expect(screen.getByRole('region', { name: 'Unlinked response records' })).toHaveTextContent(
    '3 unlinked response records were reported; no response details were returned, so they remain unassigned to a team.',
  )
})

it('renders anonymous student and group progress labels with match confidence', () => {
  render(<ProgressTables state={{
    status: 'ready',
    occurrences: [{ id: 'week-1', label: 'Week 1' }, { id: 'week-2', label: 'Week 2' }],
    students: [{ label: 'S1', matchConfidence: 'high', responsesByOccurrence: { 'week-1': 1, 'week-2': 2 } }],
    groups: [{ label: 'G1', teamSnapshotId: 'snapshot-team-a', teamSnapshotLabel: 'Team setup A', responsesByOccurrence: { 'week-1': 2, 'week-2': 3 } }],
  }} />)

  const studentTable = screen.getByRole('table', { name: 'Student progress' })
  expect(within(studentTable).getByText('S1')).toBeInTheDocument()
  expect(within(studentTable).getByText('Higher confidence match')).toBeInTheDocument()
  expect(screen.getByRole('table', { name: 'Group progress' })).toHaveTextContent('G1')
  expect(screen.queryByText(/@|email|account/i)).not.toBeInTheDocument()
})

it('distinguishes same-label group rows by immutable team snapshot id', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const { unmount } = render(<ProgressTables state={{
    status: 'ready',
    occurrences: [{ id: 'week-1', label: 'Week 1' }],
    students: [],
    groups: [
      { label: 'G1', teamSnapshotId: 'snapshot-immutable-1', teamSnapshotLabel: 'Current team setup', responsesByOccurrence: { 'week-1': 2 } },
      { label: 'G1', teamSnapshotId: 'snapshot-immutable-2', teamSnapshotLabel: 'Current team setup', responsesByOccurrence: { 'week-1': 4 } },
    ],
  }} />)

  const groupTable = screen.getByRole('table', { name: 'Group progress' })
  expect(within(groupTable).getAllByRole('row')).toHaveLength(3)
  expect(within(groupTable).getAllByText('G1')).toHaveLength(2)
  expect(within(groupTable).getByText('2')).toBeInTheDocument()
  expect(within(groupTable).getByText('4')).toBeInTheDocument()
  expect(consoleError.mock.calls.flat().join(' ')).not.toContain('same key')
  unmount()
  consoleError.mockRestore()
})

it('conditionally verifies certificates and reports per-code results without identity fields', async () => {
  const user = userEvent.setup()
  const onVerify = vi.fn()
  const hidden = render(<CertificateVerification
    enabled={false}
    surveyLabel="Week 4 Reflection"
    state={{ status: 'idle' }}
    onVerify={onVerify}
  />)
  expect(screen.queryByText('Verify completion certificates')).not.toBeInTheDocument()
  hidden.unmount()

  render(<CertificateVerification
    enabled
    surveyLabel="Week 4 Reflection"
    state={{
      status: 'complete',
      results: [{ code: 'ABCD-EFGH', status: 'valid' }, { code: 'JKLM-NPQR', status: 'not_found' }],
    }}
    onVerify={onVerify}
  />)
  await user.type(screen.getByRole('textbox', { name: /Paste codes to verify/ }), 'ABCD-EFGH, JKLM-NPQR')
  await user.click(screen.getByRole('button', { name: 'Verify certificates' }))
  expect(onVerify).toHaveBeenCalledWith(['ABCD-EFGH', 'JKLM-NPQR'])
  expect(screen.getByRole('table', { name: 'Certificate verification results' })).toHaveTextContent('Valid')
  expect(screen.getByRole('table', { name: 'Certificate verification results' })).toHaveTextContent('Not Found')
  expect(screen.queryByText(/student|identity/i)).not.toBeInTheDocument()
})
