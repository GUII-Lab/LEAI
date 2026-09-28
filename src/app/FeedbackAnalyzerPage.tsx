import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import type { CanonicalCourse } from '@/api/contracts/instructor'
import type {
  AnalysisNgramsResponse,
  AnalysisOverviewResponse,
  AnalysisProgressResponse,
  AnalysisResponse,
  AnalysisSearchResponse,
  AnalyzerResponseRequest,
  AnalysisResponsesResponse,
  CertificateVerificationRequest,
  CertificateVerificationResponse,
} from '@/api/contracts/feedback-analyzer'
import { Button } from '@/components/ui/button'
import {
  AnalysisModeTabs,
  CertificateVerification,
  CourseResponseSearch,
  MetricCards,
  NgramPanel,
  InstructorInsightsCard,
  ProgressTables,
  ResponseCard,
  ResponseList,
  TeamSurveyPanel,
  WeekScopeChips,
  type AnalysisMode,
  type AnalysisModeOption,
  type AnalysisScope,
  type AnalyzerResponse,
  type CourseResponseSearchState,
  type CertificateVerificationState,
  type GroupProgressRow,
  type ProgressState,
  type ResponseSourceFilter,
  type StudentProgressRow,
  type TeamSurveyState,
} from './feedback-analyzer/components'

export type FeedbackAnalyzerApi = {
  courses: (signal?: AbortSignal) => Promise<{ courses: readonly CanonicalCourse[] }>
  overview: (courseId: string, occurrenceIds: readonly string[] | undefined, signal?: AbortSignal) => Promise<AnalysisOverviewResponse>
  responses: (courseId: string, request: AnalyzerResponseRequest, signal?: AbortSignal) => Promise<AnalysisResponsesResponse>
  responseDetail: (courseId: string, responseId: string, signal?: AbortSignal) => Promise<AnalysisResponse>
  verifyCertificates: (courseId: string, input: CertificateVerificationRequest) => Promise<CertificateVerificationResponse>
  ngrams: (courseId: string, occurrenceIds: readonly string[], size: 1 | 2 | 3, signal?: AbortSignal) => Promise<AnalysisNgramsResponse>
  search: (courseId: string, query: string, signal?: AbortSignal) => Promise<AnalysisSearchResponse>
  progress: (courseId: string, occurrenceIds: readonly string[], signal?: AbortSignal) => Promise<AnalysisProgressResponse>
}

const modes: readonly AnalysisModeOption[] = [
  { value: 'general', label: 'General Course Feedback' },
  { value: 'structured', label: 'Structured Reflection' },
  { value: 'team', label: 'In-Group Feedback' },
  { value: 'student-progress', label: 'Student progress' },
  { value: 'group-progress', label: 'Group progress' },
]

export function FeedbackAnalyzerPage({ api, verified }: { api: FeedbackAnalyzerApi; verified: boolean }) {
  const routeParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const linkedOccurrenceId = routeParams.get('occurrence_id') ?? ''
  const linkedResponseId = routeParams.get('response_id') ?? ''
  const linkedMessageIdRaw = routeParams.get('response_message_id') ?? ''
  const linkedMessageId = /^\d{1,20}$/.test(linkedMessageIdRaw) ? linkedMessageIdRaw : ''
  const [selectedCourseId, setSelectedCourseId] = useState(() => routeParams.get('course_id') ?? '')
  const [mode, setMode] = useState<AnalysisMode>('general')
  const [selectedScopeId, setSelectedScopeId] = useState(() => linkedOccurrenceId || 'all')
  const [selectedSurveyId, setSelectedSurveyId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [sourceFilter, setSourceFilter] = useState<ResponseSourceFilter>('all')
  const [nudgedOnly, setNudgedOnly] = useState(false)
  const [ngramSize, setNgramSize] = useState<1 | 2 | 3>(1)
  const [ngramSort, setNgramSort] = useState<'frequency' | 'keyness'>('frequency')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const coursesQuery = useQuery({
    queryKey: ['feedback-analyzer-courses'],
    queryFn: ({ signal }) => api.courses(signal),
    enabled: verified,
    retry: false,
  })
  const courses = coursesQuery.data?.courses ?? []
  const courseId = courses.some((course) => course.course_id === selectedCourseId)
    ? selectedCourseId
    : courses[0]?.course_id ?? ''
  const course = courses.find((item) => item.course_id === courseId)
  const canAnalyze = course?.allowed_actions.includes('analysis.use') ?? false
  const canViewResponses = course?.allowed_actions.includes('responses.view') ?? false

  const allOverviewQuery = useQuery({
    queryKey: ['feedback-analyzer-overview', courseId, 'all'],
    queryFn: ({ signal }) => api.overview(courseId, undefined, signal),
    enabled: verified && Boolean(courseId) && canAnalyze,
    retry: false,
  })
  const allOccurrences = allOverviewQuery.data?.occurrences
  useEffect(() => {
    const linkedOccurrence = allOccurrences?.find((occurrence) => occurrence.id === linkedOccurrenceId)
    if (!linkedOccurrence) return
    setMode(linkedOccurrence.mode)
    setSelectedScopeId(linkedOccurrence.id)
    setSelectedSurveyId(linkedOccurrence.mode === 'team' ? linkedOccurrence.id : '')
  }, [allOccurrences, linkedOccurrenceId])
  const modeOccurrences = useMemo(() => {
    if (mode === 'general' || mode === 'structured' || mode === 'team') {
      return (allOccurrences ?? []).filter((occurrence) => occurrence.mode === mode)
    }
    return allOccurrences ?? []
  }, [allOccurrences, mode])
  const scopes: readonly AnalysisScope[] = useMemo(() => [
    { id: 'all', label: 'All weeks' },
    ...modeOccurrences.map((occurrence) => ({ id: occurrence.id, label: occurrence.label })),
  ], [modeOccurrences])
  const activeScopeId = scopes.some((scope) => scope.id === selectedScopeId) ? selectedScopeId : 'all'
  const scopedOccurrences = activeScopeId === 'all'
    ? modeOccurrences
    : modeOccurrences.filter((occurrence) => occurrence.id === activeScopeId)
  const certificateOccurrence = (mode === 'general' || mode === 'structured') && activeScopeId !== 'all'
    ? scopedOccurrences.find((occurrence) => occurrence.audience === 'individual' && occurrence.completion_certificate_enabled)
    : undefined
  const certificateMutation = useMutation({
    mutationFn: async ({ targetCourseId, occurrenceId, codes }: { targetCourseId: string; occurrenceId: string; codes: string[] }) => {
      const result = await api.verifyCertificates(targetCourseId, { occurrence_id: occurrenceId, codes })
      if (result.results.length !== codes.length) throw new Error('Incomplete certificate verification results')
      return result
    },
  })
  const certificateTargetIsCurrent = certificateMutation.variables?.targetCourseId === courseId
    && certificateMutation.variables?.occurrenceId === certificateOccurrence?.id
  const certificateState: CertificateVerificationState = certificateMutation.isPending && certificateTargetIsCurrent
    ? { status: 'submitting' }
    : certificateMutation.isError && certificateTargetIsCurrent
      ? { status: 'error', message: 'Could not verify these certificate codes for this survey.' }
      : certificateMutation.isSuccess && certificateTargetIsCurrent
        ? {
            status: 'complete',
            results: certificateMutation.data.results.map((valid, index) => ({
              code: certificateMutation.variables.codes[index] ?? '',
              status: valid ? 'valid' : 'not_found',
            })),
          }
        : { status: 'idle' }
  const occurrenceIds = useMemo(() => scopedOccurrences.map((occurrence) => occurrence.id), [scopedOccurrences])
  const scopeKey = occurrenceIds.join(',')

  const overviewQuery = useQuery({
    queryKey: ['feedback-analyzer-overview', courseId, scopeKey],
    queryFn: ({ signal }) => api.overview(courseId, occurrenceIds, signal),
    enabled: verified && Boolean(courseId) && canAnalyze && allOverviewQuery.isSuccess && mode !== 'team' && mode !== 'student-progress' && mode !== 'group-progress',
    retry: false,
  })
  const responseQuery = useInfiniteQuery({
    queryKey: ['feedback-analyzer-responses', courseId, scopeKey, sourceFilter, nudgedOnly],
    queryFn: ({ pageParam, signal }) => api.responses(courseId, {
      occurrenceIds,
      cursor: pageParam ?? undefined,
      limit: 25,
      source: sourceFilter,
      nudgedOnly,
    }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor ?? undefined : undefined,
    enabled: verified && Boolean(courseId) && canViewResponses && allOverviewQuery.isSuccess && mode !== 'team' && mode !== 'student-progress' && mode !== 'group-progress',
    retry: false,
  })
  const responseDetailQuery = useQuery({
    queryKey: ['feedback-analyzer-response-detail', courseId, linkedResponseId],
    queryFn: ({ signal }) => api.responseDetail(courseId, linkedResponseId, signal),
    enabled: verified && Boolean(courseId) && canViewResponses && Boolean(linkedResponseId),
    retry: false,
  })
  const ngramQuery = useQuery({
    queryKey: ['feedback-analyzer-ngrams', courseId, scopeKey, ngramSize],
    queryFn: ({ signal }) => api.ngrams(courseId, occurrenceIds, ngramSize, signal),
    enabled: verified && Boolean(courseId) && canAnalyze && allOverviewQuery.isSuccess && (mode === 'general' || mode === 'structured'),
    retry: false,
  })
  const ngramResponseQuery = useInfiniteQuery({
    queryKey: ['feedback-analyzer-ngram-responses', courseId, scopeKey, selectedTerm],
    queryFn: ({ pageParam, signal }) => api.responses(courseId, {
      occurrenceIds,
      cursor: pageParam ?? undefined,
      limit: 25,
      source: 'all',
      nudgedOnly: false,
      term: selectedTerm,
    }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor ?? undefined : undefined,
    enabled: verified && Boolean(courseId) && canViewResponses && allOverviewQuery.isSuccess && Boolean(selectedTerm) && (mode === 'general' || mode === 'structured'),
    retry: false,
  })
  const searchQuery = useQuery({
    queryKey: ['feedback-analyzer-search', courseId, searchTerm],
    queryFn: ({ signal }) => api.search(courseId, searchTerm, signal),
    enabled: verified && Boolean(courseId) && canViewResponses && searchTerm.length >= 2,
    retry: false,
  })
  const progressQuery = useQuery({
    queryKey: ['feedback-analyzer-progress', courseId],
    queryFn: ({ signal }) => api.progress(courseId, (allOccurrences ?? []).map((occurrence) => occurrence.id), signal),
    enabled: verified && Boolean(courseId) && canAnalyze && allOverviewQuery.isSuccess && (mode === 'student-progress' || mode === 'group-progress'),
    retry: false,
  })

  const selectedTeamSurvey = allOverviewQuery.data?.team_surveys.find((survey) => survey.id === selectedSurveyId)
    ?? allOverviewQuery.data?.team_surveys[0]
  const teamResponsesQuery = useInfiniteQuery({
    queryKey: ['feedback-analyzer-team-responses', courseId, selectedTeamSurvey?.id, selectedTeamId],
    queryFn: ({ pageParam, signal }) => api.responses(courseId, {
      occurrenceIds: selectedTeamSurvey ? [selectedTeamSurvey.id] : [],
      limit: 100,
      cursor: pageParam ?? undefined,
      source: 'all',
      nudgedOnly: false,
      teamSnapshotItemId: selectedTeamId,
    }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor ?? undefined : undefined,
    enabled: verified && Boolean(courseId) && mode === 'team' && Boolean(selectedTeamSurvey) && Boolean(selectedTeamId),
    retry: false,
  })
  const unlinkedResponsesQuery = useInfiniteQuery({
    queryKey: ['feedback-analyzer-unlinked-responses', courseId, selectedTeamSurvey?.id],
    queryFn: ({ pageParam, signal }) => api.responses(courseId, {
      occurrenceIds: selectedTeamSurvey ? [selectedTeamSurvey.id] : [],
      limit: 100,
      cursor: pageParam ?? undefined,
      source: 'all',
      nudgedOnly: false,
      unlinkedOccurrenceId: selectedTeamSurvey?.id,
    }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor ?? undefined : undefined,
    enabled: verified && Boolean(courseId) && mode === 'team' && Boolean(selectedTeamSurvey?.unlinked_response_count),
    retry: false,
  })

  useEffect(() => {
    if (!responseDetailQuery.data || !linkedMessageId) return
    document.getElementById(`response-message-${linkedMessageId}`)?.scrollIntoView?.({ block: 'center' })
  }, [linkedMessageId, responseDetailQuery.data])

  if (!verified) return <p className="mt-6 text-base text-muted-foreground">Waiting for backend identity verification before opening instructor feedback.</p>
  if (coursesQuery.isPending) return <p className="mt-6 text-base text-muted-foreground" role="status">Loading your courses…</p>
  if (coursesQuery.isError) return <div className="mt-6 space-y-3" role="alert"><p className="text-base text-destructive">Could not load your courses.</p><Button onClick={() => void coursesQuery.refetch()} type="button" variant="outline">Retry loading courses</Button></div>
  if (courses.length === 0) return <p className="mt-6 text-base text-muted-foreground">No active courses are available for this account.</p>

  return <div className="mt-6 space-y-5">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 space-y-1.5 text-base font-medium">Course
        <select
          aria-label="Course"
          className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={(event) => {
            setSelectedCourseId(event.target.value)
            setSelectedScopeId('all')
            setSelectedSurveyId('')
            setSelectedTeamId('')
            setSelectedTerm('')
            setSearchTerm('')
          }}
          value={courseId}
        >{courses.map((item) => <option key={item.course_id} value={item.course_id}>{item.course_name} · {item.course_code}</option>)}</select>
      </label>
    </div>

    {!canAnalyze && <p className="text-base text-muted-foreground">You do not have permission to use Feedback Analyzer for this course.</p>}
    {canAnalyze && <>
      <AnalysisModeTabs mode={mode} modes={modes} onModeChange={(nextMode) => { setMode(nextMode); setSelectedScopeId('all'); setSelectedTeamId(''); setSelectedTerm('') }} />
      {allOverviewQuery.isPending && <p className="text-base text-muted-foreground" role="status">Loading course analysis…</p>}
      {allOverviewQuery.isError && <div className="flex flex-wrap items-center gap-3" role="alert"><p className="text-base text-destructive">Could not load course analysis.</p><Button onClick={() => void allOverviewQuery.refetch()} type="button" variant="outline">Retry analysis</Button></div>}
      {allOverviewQuery.data && <>
        {(mode === 'general' || mode === 'structured' || mode === 'team') && <WeekScopeChips scopes={scopes} selectedScopeId={activeScopeId} onScopeChange={(next) => { setSelectedScopeId(next); setSelectedTerm('') }} />}
        {linkedResponseId && <section aria-label="Linked feedback response" className="space-y-3">
          <h2 className="text-lg font-semibold">Source response</h2>
          {responseDetailQuery.isPending && <p className="text-base text-muted-foreground" role="status">Loading the cited response…</p>}
          {responseDetailQuery.isError && <div className="flex flex-wrap items-center gap-3" role="alert"><p className="text-base text-destructive">The cited response is unavailable for this course.</p><Button onClick={() => void responseDetailQuery.refetch()} type="button" variant="outline">Retry source response</Button></div>}
          {responseDetailQuery.data && <ResponseCard response={toAnalyzerResponse(responseDetailQuery.data, linkedMessageId || undefined, courseId)} />}
        </section>}
        {mode === 'student-progress' || mode === 'group-progress'
          ? <ProgressTables state={progressState(progressQuery.data, progressQuery.isPending, progressQuery.isError)} onRetry={() => void progressQuery.refetch()} />
          : mode === 'team'
            ? <TeamSurveyPanel
                state={teamSurveyState(allOverviewQuery.data, selectedTeamSurvey?.id, selectedTeamId, teamResponsesQuery.data?.pages, unlinkedResponsesQuery.data?.pages, courseId, Boolean(selectedTeamId && teamResponsesQuery.isPending) || Boolean(selectedTeamSurvey?.unlinked_response_count && unlinkedResponsesQuery.isPending), Boolean(selectedTeamId && teamResponsesQuery.isError) || Boolean(selectedTeamSurvey?.unlinked_response_count && unlinkedResponsesQuery.isError))}
                selectedSurveyId={selectedTeamSurvey?.id}
                selectedTeamId={selectedTeamId}
                onSurveyChange={(id) => { setSelectedSurveyId(id); setSelectedTeamId('') }}
                onTeamChange={setSelectedTeamId}
                onRetry={() => { void teamResponsesQuery.refetch(); void unlinkedResponsesQuery.refetch() }}
              />
            : <>
                {overviewQuery.isPending && <p className="text-base text-muted-foreground" role="status">Loading metrics for this scope…</p>}
                {overviewQuery.isError && <p className="text-base text-destructive" role="alert">Could not load metrics for this scope.</p>}
                {overviewQuery.data && <MetricCards metrics={{
                  responseCount: overviewQuery.data.summary.response_count,
                  studentTurnCount: overviewQuery.data.summary.student_turn_count,
                  averageWordsPerResponse: overviewQuery.data.summary.average_words,
                  participation: { status: 'unavailable', reason: overviewQuery.data.summary.participation.reason },
                }} />}
                {certificateOccurrence && <CertificateVerification
                  enabled={canViewResponses}
                  surveyLabel={certificateOccurrence.label}
                  state={certificateState}
                  onVerify={(codes) => certificateMutation.mutate({
                    targetCourseId: courseId,
                    occurrenceId: certificateOccurrence.id,
                    codes: [...codes],
                  })}
                />}
                <NgramPanel
                  state={ngramState(ngramQuery.data, ngramQuery.isPending, ngramQuery.isError, ngramSort)}
                  ngramSize={ngramSize}
                  sort={ngramSort}
                  onNgramSizeChange={(size) => { setNgramSize(size); setSelectedTerm('') }}
                  onSortChange={setNgramSort}
                  onRetry={() => void ngramQuery.refetch()}
                  selectedTerm={canViewResponses ? selectedTerm || undefined : undefined}
                  drilldown={ngramDrilldownState(ngramResponseQuery.data?.pages.flatMap((page) => page.results) ?? [], ngramResponseQuery.isPending, ngramResponseQuery.isError, ngramResponseQuery.hasNextPage ?? false, ngramResponseQuery.isFetchingNextPage, courseId)}
                  onTermSelect={canViewResponses ? setSelectedTerm : undefined}
                  onClearTerm={() => setSelectedTerm('')}
                  onRetryDrilldown={() => void ngramResponseQuery.refetch()}
                  onLoadMore={() => void ngramResponseQuery.fetchNextPage()}
                />
                <InstructorInsightsCard state={{ status: 'unavailable', message: 'Instructor Insights are unavailable until an approved provider is configured.' }} onGenerate={() => undefined} />
                {canViewResponses && <>
                <ResponseList
                    responses={(responseQuery.data?.pages.flatMap((page) => page.results) ?? []).filter((response) => response.response_id !== responseDetailQuery.data?.response_id).map((response) => toAnalyzerResponse(response, undefined, courseId))}
                    sourceFilter={sourceFilter}
                    onSourceFilterChange={(next) => setSourceFilter(next)}
                    nudgedOnly={nudgedOnly}
                    onNudgedOnlyChange={setNudgedOnly}
                    state={responseQuery.isPending ? { status: 'loading' } : responseQuery.isError ? { status: 'error', message: 'Could not load responses for this scope.', retryable: true } : { status: 'ready' }}
                    onRetry={() => void responseQuery.refetch()}
                  />
                  {responseQuery.hasNextPage && <div className="flex justify-center"><Button disabled={responseQuery.isFetchingNextPage} onClick={() => void responseQuery.fetchNextPage()} type="button" variant="outline">{responseQuery.isFetchingNextPage ? 'Loading more responses…' : 'Load more responses'}</Button></div>}
                </>}
              </>}
        {canViewResponses && <CourseResponseSearch
          key={courseId}
          state={courseSearchState(searchTerm, searchQuery.data, searchQuery.isFetching, searchQuery.isError)}
          onSearch={(query) => {
            if (query === searchTerm) void searchQuery.refetch()
            else setSearchTerm(query)
          }}
        />}
        {mode === 'team' && selectedTeamId && teamResponsesQuery.hasNextPage && <div className="flex justify-center">
          <Button disabled={teamResponsesQuery.isFetchingNextPage} onClick={() => void teamResponsesQuery.fetchNextPage()} type="button" variant="outline">
            {teamResponsesQuery.isFetchingNextPage ? 'Loading more team responses…' : 'Load more team responses'}
          </Button>
        </div>}
        {mode === 'team' && selectedTeamSurvey?.unlinked_response_count && unlinkedResponsesQuery.hasNextPage && <div className="flex justify-center">
          <Button disabled={unlinkedResponsesQuery.isFetchingNextPage} onClick={() => void unlinkedResponsesQuery.fetchNextPage()} type="button" variant="outline">
            {unlinkedResponsesQuery.isFetchingNextPage ? 'Loading more unlinked responses…' : 'Load more unlinked responses'}
          </Button>
        </div>}
      </>}
    </>}
  </div>
}

function toAnalyzerResponse(response: AnalysisResponse, highlightedMessageId?: string, courseId?: string): AnalyzerResponse {
  const responseHref = courseId
    ? `/FeedbackAnalyzer.html?${new URLSearchParams({ course_id: courseId, occurrence_id: response.occurrence_id, response_id: response.response_id }).toString()}`
    : response.response_href
  const common = {
    responseId: response.response_id,
    label: response.label,
    surveyLabel: response.survey_label,
    createdAt: response.created_at,
    nudged: response.nudged,
    responseHref,
  }
  return response.kind === 'pdf'
    ? { ...common, kind: 'pdf', answers: response.answers.map((answer) => ({ answerId: answer.answer_id, question: answer.question, value: answer.value })) }
    : { ...common, kind: 'chat', highlightedMessageId, transcript: response.transcript.map((message) => ({ messageId: message.message_id, content: message.content, timestamp: message.timestamp })) }
}

function ngramState(
  data: AnalysisNgramsResponse | undefined,
  isPending: boolean,
  isError: boolean,
  sort: 'frequency' | 'keyness',
) {
  if (isPending) return { status: 'loading' as const }
  if (isError || !data) return { status: 'error' as const, message: 'N-gram analysis could not be loaded.', retryable: true }
  const items = [...data.items].sort((left, right) => {
    if (sort === 'keyness') {
      if (left.keyness == null && right.keyness != null) return 1
      if (left.keyness != null && right.keyness == null) return -1
      if (left.keyness != null && right.keyness != null && left.keyness !== right.keyness) return right.keyness - left.keyness
    }
    if (left.count !== right.count) return right.count - left.count
    return left.term.localeCompare(right.term)
  })
  return {
    status: 'ready' as const,
    sourceCount: data.source_count,
    cutoffAt: data.cutoff_at,
    keynessAvailable: data.keyness_available,
    items,
  }
}

function ngramDrilldownState(
  results: readonly AnalysisResponsesResponse['results'][number][],
  isPending: boolean,
  isError: boolean,
  hasMore: boolean,
  loadingMore: boolean,
  courseId: string,
) {
  if (isPending) return { status: 'loading' as const }
  if (isError) return { status: 'error' as const, message: 'Matching responses could not be loaded.' }
  return { status: 'ready' as const, responses: results.map((response) => toAnalyzerResponse(response, undefined, courseId)), hasMore, loadingMore }
}

function courseSearchState(
  submittedTerm: string,
  data: AnalysisSearchResponse | undefined,
  isPending: boolean,
  isError: boolean,
): CourseResponseSearchState {
  if (!submittedTerm) return { status: 'idle' }
  if (isPending) return { status: 'loading' }
  if (isError || !data) return { status: 'error' }
  return {
    status: 'ready',
    results: data.results.map((result) => ({
      id: result.message_id,
      surveyLabel: result.occurrence_label,
      excerpt: result.excerpt,
      createdAt: result.created_at,
    })),
    hasMore: data.has_more,
  }
}

function progressState(
  data: AnalysisProgressResponse | undefined,
  isPending: boolean,
  isError: boolean,
): ProgressState {
  if (isPending) return { status: 'loading' }
  if (isError || !data) return { status: 'error', message: 'Could not load anonymous progress.', retryable: true }
  if (data.state === 'unavailable') return { status: 'unavailable', message: 'Cross-week matching is disabled for this course.' }
  return {
    status: 'ready',
    occurrences: data.occurrences,
    students: data.students.map((student) => ({
      label: student.label as StudentProgressRow['label'],
      matchConfidence: student.match_confidence,
      responsesByOccurrence: student.responses_by_occurrence,
    })),
    groups: data.groups.map((group) => ({
      label: group.label as GroupProgressRow['label'],
      teamSnapshotId: group.team_snapshot_id,
      teamSnapshotLabel: group.team_snapshot_label,
      responsesByOccurrence: group.responses_by_occurrence,
    })),
  }
}

function teamSurveyState(
  overview: AnalysisOverviewResponse,
  selectedSurveyId: string | undefined,
  selectedTeamId: string,
  teamResponses: readonly AnalysisResponsesResponse[] | undefined,
  unlinkedResponses: readonly AnalysisResponsesResponse[] | undefined,
  courseId: string,
  isPending: boolean,
  isError: boolean,
): TeamSurveyState {
  if (isError) return { status: 'error', message: 'Could not load team response details.', retryable: true }
  const selectedSurvey = overview.team_surveys.find((survey) => survey.id === selectedSurveyId) ?? overview.team_surveys[0]
  const selectedTeamResults = teamResponses?.flatMap((page) => page.results).map((response) => toAnalyzerResponse(response, undefined, courseId)) ?? []
  const unlinkedResults = unlinkedResponses?.flatMap((page) => page.results).map((response) => toAnalyzerResponse(response, undefined, courseId)) ?? []
  return {
    status: isPending ? 'loading' : 'ready',
    surveys: overview.team_surveys.map((survey) => ({
      id: survey.id,
      label: survey.label,
      configurationLabel: survey.configuration_label,
      teams: survey.teams.map((team) => ({
        id: team.id,
        label: team.label,
        responseCount: team.response_count,
        responses: survey.id === selectedSurvey?.id && team.id === selectedTeamId ? selectedTeamResults : [],
      })),
      unlinkedResponseCount: survey.unlinked_response_count,
      unlinkedResponses: survey.id === selectedSurvey?.id ? unlinkedResults : [],
    })),
  }
}
