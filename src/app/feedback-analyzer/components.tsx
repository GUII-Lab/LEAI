import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatTranscript } from '@/components/chat/ChatTranscript'

export type AnalysisMode = 'general' | 'structured' | 'team' | 'student-progress' | 'group-progress'
export type AnalysisModeOption = { value: AnalysisMode; label: string }

const defaultModes: readonly AnalysisModeOption[] = [
  { value: 'general', label: 'General Course Feedback' },
  { value: 'team', label: 'In-Group Feedback' },
  { value: 'structured', label: 'Structured Reflection' },
]

export function AnalysisModeTabs({
  mode,
  modes = defaultModes,
  onModeChange,
}: {
  mode: AnalysisMode
  modes?: readonly AnalysisModeOption[]
  onModeChange: (mode: AnalysisMode) => void
}) {
  return <Tabs onValueChange={(value) => {
    const selected = modes.find((option) => option.value === value)
    if (selected) onModeChange(selected.value)
  }} value={mode}>
    <TabsList aria-label="Survey mode" className="flex h-auto w-full flex-wrap justify-start gap-x-4 gap-y-1 border-b border-border" variant="line">
      {modes.map((option) => <TabsTrigger className="h-10 rounded-none px-2" key={option.value} value={option.value}>{option.label}</TabsTrigger>)}
    </TabsList>
  </Tabs>
}

export type AnalysisScope = { id: string; label: string }

export function WeekScopeChips({
  scopes,
  selectedScopeId,
  onScopeChange,
}: {
  scopes: readonly AnalysisScope[]
  selectedScopeId: string
  onScopeChange: (scopeId: string) => void
}) {
  if (scopes.length === 0) return <p className="text-base text-muted-foreground">No survey weeks are available for this course.</p>

  return <nav aria-label="Survey week scope" className="flex flex-wrap gap-2">
    {scopes.map((scope) => <Button
      aria-pressed={selectedScopeId === scope.id}
      className="text-base"
      key={scope.id}
      onClick={() => onScopeChange(scope.id)}
      size="sm"
      type="button"
      variant={selectedScopeId === scope.id ? 'secondary' : 'outline'}
    >{scope.label}</Button>)}
  </nav>
}

export type ParticipationMetric =
  | { status: 'available'; participantCount: number; eligibleParticipantCount: number }
  | { status: 'unavailable'; reason: string }

export type AnalyzerMetrics = {
  responseCount: number
  studentTurnCount: number
  averageWordsPerResponse: number | null
  participation: ParticipationMetric
}

export function MetricCards({ metrics }: { metrics: AnalyzerMetrics }) {
  const participation = metrics.participation
  const availableParticipation = participation.status === 'available'
    && Number.isFinite(participation.participantCount)
    && Number.isFinite(participation.eligibleParticipantCount)
    && participation.participantCount >= 0
    && participation.participantCount <= participation.eligibleParticipantCount
    && participation.eligibleParticipantCount > 0
    ? { participantCount: participation.participantCount, eligibleParticipantCount: participation.eligibleParticipantCount }
    : null

  return <section aria-label="Analysis metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <MetricCard label="Responses" value={metrics.responseCount.toLocaleString()} detail="Response-bearing sessions and PDF-only responses." />
    <MetricCard label="Student turns" value={metrics.studentTurnCount.toLocaleString()} detail="Student messages, counted separately from responses." />
    <MetricCard label="Average response length" value={metrics.averageWordsPerResponse == null ? 'Unavailable' : `${Math.round(metrics.averageWordsPerResponse).toLocaleString()} words`} detail="Average words per eligible response." />
    <MetricCard
      label="Participation"
      value={availableParticipation
        ? `${Math.round((availableParticipation.participantCount / availableParticipation.eligibleParticipantCount) * 100)}%`
        : 'Participation unavailable'}
      detail={availableParticipation
        ? `${availableParticipation.participantCount.toLocaleString()} of ${availableParticipation.eligibleParticipantCount.toLocaleString()} eligible participants`
        : participation.status === 'unavailable' ? participation.reason : 'An eligible participant denominator is required.'}
    />
  </section>
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card className="rounded-lg border-l-4 border-l-primary">
    <CardHeader className="gap-1.5">
      <CardDescription>{label}</CardDescription>
      <CardTitle className="text-xl font-semibold tabular-nums">{value}</CardTitle>
    </CardHeader>
    <CardContent><p className="text-sm leading-5 text-muted-foreground">{detail}</p></CardContent>
  </Card>
}

export type NgramTerm = { term: string; count: number; keyness: number | null }
export type NgramSize = 1 | 2 | 3
export type NgramSort = 'frequency' | 'keyness'
export type NgramState =
  | { status: 'loading' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; retryable: boolean }
  | { status: 'ready'; sourceCount: number; cutoffAt: string | null; keynessAvailable: boolean; items: readonly NgramTerm[] }

export type NgramDrilldownState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; responses: readonly AnalyzerResponse[]; hasMore: boolean; loadingMore: boolean }

export function NgramPanel({
  state,
  ngramSize,
  sort,
  onNgramSizeChange,
  onSortChange,
  onRetry,
  selectedTerm,
  drilldown = { status: 'idle' },
  onTermSelect,
  onClearTerm,
  onRetryDrilldown,
  onLoadMore,
}: {
  state: NgramState
  ngramSize: NgramSize
  sort: NgramSort
  onNgramSizeChange: (size: NgramSize) => void
  onSortChange: (sort: NgramSort) => void
  onRetry?: () => void
  selectedTerm?: string
  drilldown?: NgramDrilldownState
  onTermSelect?: (term: string) => void
  onClearTerm?: () => void
  onRetryDrilldown?: () => void
  onLoadMore?: () => void
}) {
  return <Card>
    <CardHeader>
      <CardTitle>N-gram terms</CardTitle>
      <CardDescription>Word frequency and keyness in the selected scope.</CardDescription>
      {state.status === 'ready' && <p className="text-xs text-muted-foreground">{state.sourceCount.toLocaleString()} responses{state.cutoffAt && <> · data through <time dateTime={state.cutoffAt}>{state.cutoffAt}</time></>}</p>}
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <fieldset className="min-w-0">
          <legend className="mb-1 text-base font-medium">N-gram length</legend>
          <div className="flex flex-wrap gap-1">
            {([1, 2, 3] as const).map((size) => <Button
              aria-pressed={ngramSize === size}
              className="text-base"
              key={size}
              onClick={() => onNgramSizeChange(size)}
              size="sm"
              type="button"
              variant={ngramSize === size ? 'secondary' : 'outline'}
            >{size === 1 ? 'Unigram' : size === 2 ? 'Bigram' : 'Trigram'}</Button>)}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-1 text-base font-medium">Sort terms</legend>
          <div className="flex flex-wrap gap-1">
            <Button aria-pressed={sort === 'frequency'} className="text-base" onClick={() => onSortChange('frequency')} size="sm" type="button" variant={sort === 'frequency' ? 'secondary' : 'outline'}>Freq</Button>
            <Button
              aria-pressed={sort === 'keyness'}
              className="text-base"
              disabled={state.status !== 'ready' || !state.keynessAvailable}
              onClick={() => onSortChange('keyness')}
              size="sm"
              title={state.status === 'ready' && !state.keynessAvailable ? 'Keyness is available only for a selected survey week.' : undefined}
              type="button"
              variant={sort === 'keyness' ? 'secondary' : 'outline'}
            >Keyness</Button>
          </div>
        </fieldset>
      </div>
      {state.status === 'loading' && <p className="text-base text-muted-foreground" role="status">Loading n-gram terms…</p>}
      {state.status === 'unavailable' && <p className="text-base text-muted-foreground" role="status">{state.message}</p>}
      {state.status === 'error' && <div className="flex flex-wrap items-center gap-3" role="alert">
        <p className="text-base text-destructive">{state.message}</p>
        {state.retryable && onRetry && <Button onClick={onRetry} type="button" variant="outline">Retry n-gram analysis</Button>}
      </div>}
      {state.status === 'ready' && (state.items.length === 0
        ? <p className="text-base text-muted-foreground">No n-gram terms are available for this scope.</p>
        : <div className="overflow-x-auto">
          <table aria-label="N-gram terms" className="w-full min-w-72 text-left text-base">
            <thead><tr className="border-b border-border text-base text-muted-foreground"><th className="px-2 py-2 font-medium">Term</th><th className="px-2 py-2 text-right font-medium">Frequency</th>{sort === 'keyness' && <th className="px-2 py-2 text-right font-medium">Keyness</th>}</tr></thead>
            <tbody>{state.items.map((item) => <tr className="border-b border-border last:border-0" key={item.term}>
              <th className="px-2 py-2 font-medium" scope="row">{onTermSelect
                ? <Button aria-pressed={selectedTerm === item.term} className="h-auto p-0 font-medium" onClick={() => onTermSelect(item.term)} type="button" variant="link">{item.term}</Button>
                : item.term}</th>
              <td className="px-2 py-2 text-right tabular-nums">{item.count.toLocaleString()}</td>
              {sort === 'keyness' && <td className="px-2 py-2 text-right tabular-nums">{item.keyness == null ? 'Unavailable' : item.keyness.toFixed(2)}</td>}
            </tr>)}</tbody>
          </table>
        </div>)}
      {selectedTerm && <section aria-label={`Responses matching ${selectedTerm}`} className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Responses matching “{selectedTerm}”</h3>
          {onClearTerm && <Button className="text-base" onClick={onClearTerm} size="sm" type="button" variant="outline">Clear term</Button>}
        </div>
        {drilldown.status === 'loading' && <p className="text-base text-muted-foreground" role="status">Loading matching responses…</p>}
        {drilldown.status === 'error' && <div className="flex flex-wrap items-center gap-3" role="alert"><p className="text-base text-destructive">{drilldown.message}</p>{onRetryDrilldown && <Button onClick={onRetryDrilldown} type="button" variant="outline">Retry matching responses</Button>}</div>}
        {drilldown.status === 'ready' && (drilldown.responses.length === 0
          ? <p className="text-base text-muted-foreground">No matching responses were found in this scope.</p>
          : <ul className="space-y-3">{drilldown.responses.map((response) => <li key={response.responseId}><ResponseCard response={response} /></li>)}</ul>)}
        {drilldown.status === 'ready' && drilldown.hasMore && onLoadMore && <Button disabled={drilldown.loadingMore} onClick={onLoadMore} type="button" variant="outline">{drilldown.loadingMore ? 'Loading more matches…' : 'Load more matching responses'}</Button>}
      </section>}
    </CardContent>
  </Card>
}

export type CourseSearchResult = { id: number; surveyLabel: string; excerpt: string; createdAt: string }
export type CourseResponseSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; results: readonly CourseSearchResult[]; hasMore: boolean }

export function CourseResponseSearch({
  state,
  onSearch,
}: {
  state: CourseResponseSearchState
  onSearch: (query: string) => void
}) {
  const [query, setQuery] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = query.trim()
    if (normalized.length >= 2 && normalized.length <= 100) onSearch(normalized)
  }

  return <Card>
    <CardHeader><CardTitle>Search course responses</CardTitle><CardDescription>Search covers completed responses across all surveys.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit} role="search">
        <Input aria-label="Search course responses" maxLength={100} minLength={2} onChange={(event) => setQuery(event.target.value)} placeholder="Search a word or phrase" required type="search" value={query} />
        <Button disabled={state.status === 'loading' || query.trim().length < 2} type="submit">{state.status === 'loading' ? 'Searching…' : 'Search course responses'}</Button>
      </form>
      {state.status === 'loading' && <p className="text-base text-muted-foreground" role="status">Searching responses…</p>}
      {state.status === 'error' && <p className="text-base text-destructive" role="alert">Search could not be completed. Please try again.</p>}
      {state.status === 'ready' && <div aria-label="Course response search results" aria-live="polite" className="space-y-3" role="region">
        <p className="text-base text-muted-foreground">{state.results.length === 0 ? 'No matching responses found.' : `${state.results.length} matching response${state.results.length === 1 ? '' : 's'}${state.hasMore ? ' shown. Refine your search for more.' : ''}`}</p>
        {state.results.length > 0 && <ul className="space-y-3">{state.results.map((result) => <li className="rounded-lg border border-border bg-background p-4" key={result.id}>
          <p className="text-xs font-semibold text-muted-foreground">{result.surveyLabel}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-base">{result.excerpt}</p>
          <time className="mt-2 block text-xs text-muted-foreground" dateTime={result.createdAt}>{result.createdAt}</time>
        </li>)}</ul>}
      </div>}
    </CardContent>
  </Card>
}

export type InsightCitation = { label: string; responseId: string; sourceLabel: string; excerpt: string; href: string }
export type InsightClaim = { id: string; text: string; supportingResponseCount: number; citations: readonly InsightCitation[] }
export type InstructorInsightsState =
  | { status: 'not-run'; sourceCount: number; responseCutoff: string; message?: string }
  | { status: 'pending'; sourceCount: number; responseCutoff: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; retryable: boolean }
  | { status: 'ready'; sourceCount: number; responseCutoff: string; generatedAt: string; stale: boolean; staleResponseCount?: number; claims: readonly InsightClaim[] }

export function InstructorInsightsCard({
  state,
  onGenerate,
  onRetry,
  onCitationOpen,
}: {
  state: InstructorInsightsState
  onGenerate: () => void
  onRetry?: () => void
  onCitationOpen?: (responseId: string) => void
}) {
  return <Card>
    <CardHeader className="gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Instructor Insights</CardTitle>
        {state.status === 'ready' && <Button onClick={onGenerate} type="button" variant="outline">Regenerate insights</Button>}
        {state.status === 'not-run' && <Button onClick={onGenerate} type="button">Generate Instructor Insights</Button>}
      </div>
      <CardDescription>Evidence-linked themes from the selected response population.</CardDescription>
      {(state.status === 'ready' || state.status === 'pending' || state.status === 'not-run') && <p className="text-xs text-muted-foreground">
        {state.sourceCount.toLocaleString()} responses · cutoff <time dateTime={state.responseCutoff}>{state.responseCutoff}</time>
        {state.status === 'ready' && <> · generated <time dateTime={state.generatedAt}>{state.generatedAt}</time></>}
      </p>}
    </CardHeader>
    <CardContent className="space-y-4">
      {state.status === 'not-run' && <p className="text-base text-muted-foreground">{state.message ?? 'Generate an evidence-linked summary for this scope.'}</p>}
      {state.status === 'pending' && <p className="text-base text-muted-foreground" role="status">Generating Instructor Insights for {state.sourceCount.toLocaleString()} responses through {state.responseCutoff}…</p>}
      {state.status === 'unavailable' && <p className="text-base text-muted-foreground" role="status">{state.message}</p>}
      {state.status === 'error' && <div className="flex flex-wrap items-center gap-3" role="alert">
        <p className="text-base text-destructive">{state.message}</p>
        {state.retryable && onRetry && <Button onClick={onRetry} type="button" variant="outline">Retry Instructor Insights</Button>}
      </div>}
      {state.status === 'ready' && <>
        {state.stale && <p className="rounded-md border border-border bg-muted px-3 py-2 text-base" role="status">
          {state.staleResponseCount && state.staleResponseCount > 0
            ? `${state.staleResponseCount.toLocaleString()} new responses have arrived since this snapshot.`
            : 'This snapshot is out of date for the current response scope.'}
        </p>}
        {state.claims.length === 0
          ? <p className="text-base text-muted-foreground">No insight themes are available for this snapshot.</p>
          : <ul className="space-y-4">{state.claims.map((claim) => <li className="space-y-2" key={claim.id}>
            <p className="leading-6">{claim.text}</p>
            <p className="text-xs text-muted-foreground">Supported by {claim.supportingResponseCount.toLocaleString()} responses</p>
            {claim.citations.length > 0 && <ul aria-label={`Sources for: ${claim.text}`} className="flex flex-wrap gap-2">
              {claim.citations.map((citation) => <li key={citation.responseId}>
                <Popover>
                  <PopoverTrigger asChild><Button aria-label={`Open source ${citation.label}`} size="xs" type="button" variant="outline">[{citation.label}]</Button></PopoverTrigger>
                  <PopoverContent align="start" className="max-w-sm">
                    <PopoverHeader>
                      <PopoverTitle>{citation.sourceLabel}</PopoverTitle>
                      <PopoverDescription>{citation.label}</PopoverDescription>
                    </PopoverHeader>
                    <blockquote className="border-l-2 border-border pl-3 text-base leading-5">{citation.excerpt}</blockquote>
                    <a
                      aria-label={`Open response ${citation.label}`}
                      className="text-base font-medium text-link underline underline-offset-4"
                      href={citation.href}
                      onClick={(event) => {
                        if (onCitationOpen) {
                          event.preventDefault()
                          onCitationOpen(citation.responseId)
                        }
                      }}
                    >Open exact response source</a>
                  </PopoverContent>
                </Popover>
              </li>)}
            </ul>}
          </li>)}</ul>}
      </>}
    </CardContent>
  </Card>
}

export type ChatResponse = {
  kind: 'chat'
  responseId: string
  label: string
  surveyLabel: string
  createdAt?: string
  nudged: boolean
  responseHref: string
  transcript: readonly { messageId: string; content: string; timestamp?: string }[]
  highlightedMessageId?: string
}

export type PdfResponse = {
  kind: 'pdf'
  responseId: string
  label: string
  surveyLabel: string
  createdAt?: string
  nudged: boolean
  responseHref: string
  answers: readonly { answerId: string; question: string; value: string }[]
}

export type AnalyzerResponse = ChatResponse | PdfResponse
export type ResponseSourceFilter = 'all' | 'chat' | 'pdf'
export type ResponseListState =
  | { status: 'loading' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; retryable: boolean }
  | { status: 'ready' }

export function ResponseList({
  responses,
  sourceFilter,
  onSourceFilterChange,
  nudgedOnly,
  onNudgedOnlyChange,
  state,
  onRetry,
}: {
  responses: readonly AnalyzerResponse[]
  sourceFilter: ResponseSourceFilter
  onSourceFilterChange: (source: ResponseSourceFilter) => void
  nudgedOnly: boolean
  onNudgedOnlyChange: (nudgedOnly: boolean) => void
  state: ResponseListState
  onRetry?: () => void
}) {
  const filteredResponses = responses.filter((response) => {
    const sourceMatches = sourceFilter === 'all' || response.kind === sourceFilter
    return sourceMatches && (!nudgedOnly || response.nudged)
  })

  return <section aria-labelledby="analyzer-response-heading" className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-lg font-semibold" id="analyzer-response-heading">Student Responses</h2><p className="text-base text-muted-foreground">Each card is one response record; chat messages are student turns within it.</p></div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid gap-1">
          <label className="text-base font-medium" htmlFor="response-source-filter">Response source</label>
          <Select onValueChange={(value) => {
            if (value === 'all' || value === 'chat' || value === 'pdf') onSourceFilterChange(value)
          }} value={sourceFilter}>
            <SelectTrigger id="response-source-filter" aria-label="Response source"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="chat">Chat only</SelectItem>
              <SelectItem value="pdf">PDF only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-base" htmlFor="nudged-only-filter"><Switch checked={nudgedOnly} id="nudged-only-filter" onCheckedChange={onNudgedOnlyChange} />Nudged only</label>
      </div>
    </div>
    {state.status === 'loading' && <p className="text-base text-muted-foreground" role="status">Loading student responses…</p>}
    {state.status === 'unavailable' && <p className="text-base text-muted-foreground" role="status">{state.message}</p>}
    {state.status === 'error' && <div className="flex flex-wrap items-center gap-3" role="alert">
      <p className="text-base text-destructive">{state.message}</p>
      {state.retryable && onRetry && <Button onClick={onRetry} type="button" variant="outline">Retry loading responses</Button>}
    </div>}
    {state.status === 'ready' && (filteredResponses.length === 0
      ? <p className="text-base text-muted-foreground">{nudgedOnly ? 'No nudged responses in this scope.' : 'No responses yet.'}</p>
      : <ul className="space-y-3">{filteredResponses.map((response) => <li key={response.responseId}><ResponseCard response={response} /></li>)}</ul>)}
  </section>
}

export function ResponseCard({ response }: { response: AnalyzerResponse }) {
  const turnCount = response.kind === 'chat' ? response.transcript.length : response.answers.length
  return <Card className="py-0">
    <details className="group/response" open={response.kind === 'chat' && Boolean(response.highlightedMessageId)}>
      <summary aria-label={`Show response ${response.label}`} className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-muted-foreground transition-transform group-open/response:rotate-180">⌄</span>
        <span className="font-medium">{response.label}</span>
        <span className="text-base text-muted-foreground">{response.surveyLabel}</span>
        {response.createdAt && <time className="text-xs text-muted-foreground" dateTime={response.createdAt}>{response.createdAt}</time>}
        {response.kind === 'pdf' && <Badge variant="outline" title="This response was imported from a PDF reflection.">PDF</Badge>}
        {response.nudged && <Badge variant="secondary" title="The conversation included a prompt to speak with a person.">Nudged</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{response.kind === 'pdf' ? `${turnCount} parsed answer${turnCount === 1 ? '' : 's'}` : `${turnCount} student turn${turnCount === 1 ? '' : 's'}`}</span>
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        <Button asChild className="text-base" size="sm" variant="outline"><a href={response.responseHref}>Open response {response.label}</a></Button>
        {response.kind === 'chat'
          ? <section aria-label={`Transcript for response ${response.label}`}>
            {response.transcript.length === 0
              ? <p className="text-base text-muted-foreground">No student turns are available for this response.</p>
              : <ChatTranscript>{response.transcript.map((message) => <ChatMessage author="Student" key={message.messageId} role="user" timestamp={message.timestamp}>
                <div className={`rounded-lg p-2 ${message.messageId === response.highlightedMessageId ? 'ring-2 ring-primary' : ''}`.trim()} id={`response-message-${message.messageId}`}>
                  {message.content}
                </div>
              </ChatMessage>)}</ChatTranscript>}
          </section>
          : response.answers.length === 0
            ? <p className="text-base text-muted-foreground">No parsed answers are available for this PDF response.</p>
            : <dl className="space-y-3">{response.answers.map((answer) => <div className="grid gap-1" key={answer.answerId}>
              <dt className="text-base font-medium">{answer.question}</dt><dd className="whitespace-pre-wrap text-base text-muted-foreground">{answer.value}</dd>
            </div>)}</dl>}
      </div>
    </details>
  </Card>
}

export type PdfImportBatch = { id: string; label: string; status: 'queued' | 'processing' | 'ready' | 'failed' | 'committed' | 'reverted'; fileCount: number }
export type PdfParsedAnswers =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; answers: readonly { id: string; sourceLabel: string; question: string; value: string }[] }

const PDF_IMPORT_LIMITS = {
  maxFiles: 50,
  maxFileBytes: 10 * 1024 * 1024,
  maxBatchBytes: 50 * 1024 * 1024,
} as const

function pdfSelectionError(files: readonly File[]): string {
  if (files.length > PDF_IMPORT_LIMITS.maxFiles) return 'A batch can include at most 50 PDF files.'
  if (files.some((file) => file.size > PDF_IMPORT_LIMITS.maxFileBytes)) return 'Each PDF must be 10 MiB or smaller.'
  if (files.reduce((total, file) => total + file.size, 0) > PDF_IMPORT_LIMITS.maxBatchBytes) return 'A batch can total no more than 50 MiB.'
  return ''
}

type PdfImportPanelProps =
  | { mode: 'team' }
  | {
    mode: 'structured'
    onFilesSelected: (files: readonly File[]) => void
    batches: readonly PdfImportBatch[]
    batchListState: 'loading' | 'ready' | 'error'
    parsedAnswers: PdfParsedAnswers
    onCommit: (batchId: string) => void
    onRevert: (batchId: string) => void
    onRetryBatches?: () => void
  }

export function PdfImportPanel(props: PdfImportPanelProps) {
  const [selectionError, setSelectionError] = useState('')
  if (props.mode === 'team') return <Card>
    <CardHeader><CardTitle>PDF reflection import</CardTitle></CardHeader>
    <CardContent><p className="text-base text-muted-foreground">Team PDF import is not supported because a PDF response cannot be attributed to an exact team.</p></CardContent>
  </Card>

  const { onFilesSelected, batches, batchListState, parsedAnswers, onCommit, onRevert, onRetryBatches } = props

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    if (!event.currentTarget.files) return
    const files = Array.from(event.currentTarget.files)
    const error = pdfSelectionError(files)
    setSelectionError(error)
    event.currentTarget.value = ''
    if (!error) onFilesSelected(files)
  }

  return <Card>
    <CardHeader><CardTitle>PDF reflection import</CardTitle><CardDescription>Upload individual structured reflections for the selected survey week.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-2">
        <label className="text-base font-medium" htmlFor="pdf-reflection-files">Choose PDF reflections</label>
        <input accept="application/pdf,.pdf" aria-describedby="pdf-reflection-files-help" className="block w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-base file:font-medium" id="pdf-reflection-files" multiple onChange={selectFiles} type="file" />
        <p className="text-sm text-muted-foreground" id="pdf-reflection-files-help">Original PDFs are discarded after processing. Up to 50 files per batch, 10 MiB each, 50 MiB total.</p>
        {selectionError && <p className="text-base text-destructive" role="alert">{selectionError}</p>}
      </div>
      <section aria-labelledby="pdf-recent-batches-heading" className="space-y-2">
        <h3 className="text-base font-semibold" id="pdf-recent-batches-heading">Recent PDF uploads</h3>
        {batchListState === 'loading' && <p className="text-base text-muted-foreground" role="status">Loading recent uploads…</p>}
        {batchListState === 'error' && <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-base text-destructive">Could not load recent PDF uploads.</p>
          {onRetryBatches && <Button onClick={onRetryBatches} type="button" variant="outline">Retry PDF uploads</Button>}
        </div>}
        {batchListState === 'ready' && (batches.length === 0
          ? <p className="text-base text-muted-foreground">No PDF uploads yet.</p>
          : <ul className="space-y-2">{batches.map((batch) => <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3" key={batch.id}>
            <div className="min-w-0"><p className="font-medium">{batch.label}</p><p className="text-sm text-muted-foreground">{batch.fileCount.toLocaleString()} PDF file{batch.fileCount === 1 ? '' : 's'} · {batch.status}</p></div>
            <div className="flex flex-wrap gap-2">
              {batch.status === 'ready' && <Button className="text-base" onClick={() => onCommit(batch.id)} size="sm" type="button">Commit {batch.label}</Button>}
              {batch.status === 'committed' && <Button className="text-base" onClick={() => onRevert(batch.id)} size="sm" type="button" variant="outline">Revert {batch.label}</Button>}
            </div>
          </li>)}</ul>)}
      </section>
      <section aria-labelledby="pdf-parsed-answers-heading" className="space-y-2">
        <h3 className="text-base font-semibold" id="pdf-parsed-answers-heading">Parsed answers</h3>
        {parsedAnswers.status === 'idle' && <p className="text-base text-muted-foreground">Select a recent upload to review its parsed answers.</p>}
        {parsedAnswers.status === 'loading' && <p className="text-base text-muted-foreground" role="status">Loading parsed answers…</p>}
        {parsedAnswers.status === 'unavailable' && <p className="text-base text-muted-foreground" role="status">{parsedAnswers.message}</p>}
        {parsedAnswers.status === 'error' && <p className="text-base text-destructive" role="alert">{parsedAnswers.message}</p>}
        {parsedAnswers.status === 'ready' && (parsedAnswers.answers.length === 0
          ? <p className="text-base text-muted-foreground">No parsed answers for this import yet.</p>
          : <ul className="space-y-3">{parsedAnswers.answers.map((answer) => <li className="grid gap-1" key={answer.id}>
            <p className="text-sm text-muted-foreground">{answer.sourceLabel}</p><p className="font-medium">{answer.question}</p><p className="whitespace-pre-wrap text-base">{answer.value}</p>
          </li>)}</ul>)}
      </section>
    </CardContent>
  </Card>
}

export type TeamSurvey = {
  id: string
  label: string
  configurationLabel: string
  teams: readonly { id: string; label: string; responseCount: number; responses: readonly AnalyzerResponse[] }[]
  unlinkedResponseCount: number
  unlinkedResponses: readonly AnalyzerResponse[]
}

export type TeamSurveyState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retryable: boolean }
  | { status: 'ready'; surveys: readonly TeamSurvey[] }

export function TeamSurveyPanel({
  state,
  selectedSurveyId,
  selectedTeamId,
  onSurveyChange,
  onTeamChange,
  onRetry,
}: {
  state: TeamSurveyState
  selectedSurveyId?: string
  selectedTeamId?: string
  onSurveyChange: (surveyId: string) => void
  onTeamChange: (teamId: string) => void
  onRetry?: () => void
}) {
  const selectedSurvey = state.status === 'ready'
    ? state.surveys.find((survey) => survey.id === selectedSurveyId) ?? state.surveys[0]
    : undefined

  return <Card>
    <CardHeader><CardTitle>In-Group Feedback</CardTitle><CardDescription>Team responses stay grouped by the selected team survey.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {state.status === 'loading' && <p className="text-base text-muted-foreground" role="status">Loading team surveys…</p>}
      {state.status === 'error' && <div className="flex flex-wrap items-center gap-3" role="alert"><p className="text-base text-destructive">{state.message}</p>{state.retryable && onRetry && <Button onClick={onRetry} type="button" variant="outline">Retry team surveys</Button>}</div>}
      {state.status === 'ready' && state.surveys.length === 0 && <p className="text-base text-muted-foreground">No In-Group surveys for this course yet.</p>}
      {state.status === 'ready' && state.surveys.length > 0 && <>
        <nav aria-label="In-Group surveys" className="flex flex-wrap gap-2">
          {state.surveys.map((survey) => <Button aria-pressed={selectedSurvey?.id === survey.id} className="text-base" key={survey.id} onClick={() => onSurveyChange(survey.id)} size="sm" type="button" variant={selectedSurvey?.id === survey.id ? 'secondary' : 'outline'}>{survey.label}</Button>)}
        </nav>
        {selectedSurvey && <>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Team setup: {selectedSurvey.configurationLabel}</p>
            {selectedSurvey.teams.length === 0
              ? <p className="text-base text-muted-foreground">No team responses are available for this survey.</p>
              : <div className="overflow-x-auto">
                <table aria-label="Team response counts" className="w-full min-w-64 text-left text-base">
                  <thead><tr className="border-b border-border text-base text-muted-foreground"><th className="px-2 py-2 font-medium">Team</th><th className="px-2 py-2 text-right font-medium">Responses</th><th className="px-2 py-2 text-right font-medium"><span className="sr-only">Open team</span></th></tr></thead>
                  <tbody>{selectedSurvey.teams.map((team) => <tr className="border-b border-border last:border-0" key={team.id}>
                    <th className="px-2 py-2 font-medium" scope="row">{team.label}</th><td className="px-2 py-2 text-right tabular-nums">{team.responseCount.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right"><Button className="text-base" onClick={() => onTeamChange(team.id)} size="sm" type="button" variant="outline">View {team.label}</Button></td>
                  </tr>)}</tbody>
                  <tfoot><tr className="border-t border-border"><th className="px-2 py-2 font-medium" scope="row">Unlinked responses</th><td className="px-2 py-2 text-right tabular-nums">{selectedSurvey.unlinkedResponseCount.toLocaleString()}</td><td className="px-2 py-2"><span className="sr-only">Not assigned to a team</span></td></tr></tfoot>
                </table>
              </div>}
            {(() => {
              const selectedTeam = selectedSurvey.teams.find((team) => team.id === selectedTeamId)
              return selectedTeam && <section aria-label={`Responses for ${selectedTeam.label}`} className="space-y-2">
                <h3 className="font-semibold">{selectedTeam.label} responses</h3>
                {selectedTeam.responses.length === 0
                  ? <p className="text-base text-muted-foreground">No responses are available for this team.</p>
                  : <ul className="space-y-3">{selectedTeam.responses.map((response) => <li key={response.responseId}><ResponseCard response={response} /></li>)}</ul>}
              </section>
            })()}
            {(selectedSurvey.unlinkedResponseCount > 0 || selectedSurvey.unlinkedResponses.length > 0) && <section aria-label="Unlinked response records" className="space-y-2">
              <h3 className="font-semibold">Unlinked response records</h3>
              {selectedSurvey.unlinkedResponses.length === 0
                ? <p className="text-base text-muted-foreground">{selectedSurvey.unlinkedResponseCount.toLocaleString()} unlinked response record{selectedSurvey.unlinkedResponseCount === 1 ? ' was' : 's were'} reported; no response details were returned, so they remain unassigned to a team.</p>
                : <>
                  <p className="text-base text-muted-foreground">These response details are available for review and are not assigned to a team.</p>
                  <ul className="space-y-3">{selectedSurvey.unlinkedResponses.map((response) => <li key={response.responseId}><ResponseCard response={response} /></li>)}</ul>
                </>}
            </section>}
          </div>
        </>}
      </>}
    </CardContent>
  </Card>
}

export type AnonymousStudentLabel = `S${number}`
export type AnonymousGroupLabel = `G${number}`
export type MatchConfidence = 'high' | 'moderate' | 'low' | 'unlinked'
export type ProgressOccurrence = { id: string; label: string }
export type StudentProgressRow = { label: AnonymousStudentLabel; matchConfidence: MatchConfidence; responsesByOccurrence: Readonly<Record<string, number>> }
export type GroupProgressRow = { label: AnonymousGroupLabel; teamSnapshotId: string; teamSnapshotLabel: string; responsesByOccurrence: Readonly<Record<string, number>> }
export type ProgressState =
  | { status: 'loading' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; retryable: boolean }
  | { status: 'ready'; occurrences: readonly ProgressOccurrence[]; students: readonly StudentProgressRow[]; groups: readonly GroupProgressRow[] }

export function ProgressTables({ state, onRetry }: { state: ProgressState; onRetry?: () => void }) {
  return <section aria-labelledby="progress-heading" className="space-y-4">
    <h2 className="text-lg font-semibold" id="progress-heading">Student and Group Progress</h2>
    {state.status === 'loading' && <p className="text-base text-muted-foreground" role="status">Loading anonymous progress…</p>}
    {state.status === 'unavailable' && <p className="text-base text-muted-foreground" role="status">{state.message}</p>}
    {state.status === 'error' && <div className="flex flex-wrap items-center gap-3" role="alert"><p className="text-base text-destructive">{state.message}</p>{state.retryable && onRetry && <Button onClick={onRetry} type="button" variant="outline">Retry progress</Button>}</div>}
    {state.status === 'ready' && <>
      <Card>
        <CardHeader><CardTitle>Student Progress</CardTitle><CardDescription>Anonymous labels and match confidence only.</CardDescription></CardHeader>
        <CardContent>{state.students.length === 0
          ? <p className="text-base text-muted-foreground">No cross-week student matches are available.</p>
          : <div className="overflow-x-auto"><table aria-label="Student progress" className="w-full min-w-80 text-left text-base">
            <thead><tr className="border-b border-border text-base text-muted-foreground"><th className="px-2 py-2 font-medium">Anonymous label</th><th className="px-2 py-2 font-medium">Match confidence</th>{state.occurrences.map((occurrence) => <th className="px-2 py-2 text-right font-medium" key={occurrence.id}>{occurrence.label}</th>)}</tr></thead>
            <tbody>{state.students.map((student) => <tr className="border-b border-border last:border-0" key={student.label}>
              <th className="px-2 py-2 font-medium" scope="row">{student.label}</th><td className="px-2 py-2">{confidenceLabel(student.matchConfidence)}</td>
              {state.occurrences.map((occurrence) => <td className="px-2 py-2 text-right tabular-nums" key={occurrence.id}>{student.responsesByOccurrence[occurrence.id] ?? '—'}</td>)}
            </tr>)}</tbody>
          </table></div>}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Group Progress</CardTitle><CardDescription>Groups stay separate for each team configuration snapshot.</CardDescription></CardHeader>
        <CardContent>{state.groups.length === 0
          ? <p className="text-base text-muted-foreground">No anonymous group progress is available.</p>
          : <div className="overflow-x-auto"><table aria-label="Group progress" className="w-full min-w-80 text-left text-base">
            <thead><tr className="border-b border-border text-base text-muted-foreground"><th className="px-2 py-2 font-medium">Anonymous group</th><th className="px-2 py-2 font-medium">Team setup snapshot</th>{state.occurrences.map((occurrence) => <th className="px-2 py-2 text-right font-medium" key={occurrence.id}>{occurrence.label}</th>)}</tr></thead>
            <tbody>{state.groups.map((group) => <tr className="border-b border-border last:border-0" key={`${group.teamSnapshotId}:${group.label}`}>
              <th className="px-2 py-2 font-medium" scope="row">{group.label}</th><td className="px-2 py-2">{group.teamSnapshotLabel}</td>
              {state.occurrences.map((occurrence) => <td className="px-2 py-2 text-right tabular-nums" key={occurrence.id}>{group.responsesByOccurrence[occurrence.id] ?? '—'}</td>)}
            </tr>)}</tbody>
          </table></div>}</CardContent>
      </Card>
    </>}
  </section>
}

function confidenceLabel(confidence: MatchConfidence) {
  if (confidence === 'high') return 'Higher confidence match'
  if (confidence === 'moderate') return 'Moderate confidence match'
  if (confidence === 'low') return 'Lower confidence match'
  return 'No cross-week match'
}

export type CertificateResult = { code: string; status: string }
export type CertificateVerificationState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string }
  | { status: 'complete'; results: readonly CertificateResult[] }

export function CertificateVerification({
  enabled,
  surveyLabel,
  state,
  onVerify,
}: {
  enabled: boolean
  surveyLabel: string
  state: CertificateVerificationState
  onVerify: (codes: readonly string[]) => void
}) {
  const [rawCodes, setRawCodes] = useState('')
  const [validationMessage, setValidationMessage] = useState('')
  if (!enabled) return null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const codes = rawCodes.split(/[\n,]+/).map((code) => code.trim()).filter(Boolean)
    if (codes.length === 0) {
      setValidationMessage('Enter at least one certificate code.')
      return
    }
    if (codes.length > 100) {
      setValidationMessage('Verify up to 100 certificate codes at a time.')
      return
    }
    setValidationMessage('')
    onVerify(codes)
  }

  return <Card>
    <CardHeader><CardTitle>Verify completion certificates</CardTitle><CardDescription>Check issued codes for {surveyLabel}. A valid code confirms issuance for this survey, not who submitted it.</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <form className="space-y-3" onSubmit={submit}>
        <label className="grid gap-1.5 text-base font-medium" htmlFor="certificate-codes">Paste codes to verify <span className="font-normal text-muted-foreground">One per line or comma-separated.</span>
          <Textarea disabled={state.status === 'submitting'} id="certificate-codes" name="codes" onChange={(event) => setRawCodes(event.currentTarget.value)} placeholder="ABCD-EFGH-JKLM-NPQR" rows={4} value={rawCodes} />
        </label>
        {validationMessage && <p className="text-base text-destructive" role="alert">{validationMessage}</p>}
        <Button disabled={state.status === 'submitting'} type="submit">{state.status === 'submitting' ? 'Verifying codes…' : 'Verify certificates'}</Button>
      </form>
      {state.status === 'submitting' && <p className="text-base text-muted-foreground" role="status">Verifying certificates for {surveyLabel}…</p>}
      {state.status === 'error' && <p className="text-base text-destructive" role="alert">{state.message}</p>}
      {state.status === 'complete' && <>
        {state.results.length === 0
          ? <p className="text-base text-muted-foreground">No certificate results were returned.</p>
          : <div className="overflow-x-auto"><table aria-label="Certificate verification results" className="w-full min-w-64 text-left text-base">
            <thead><tr className="border-b border-border text-base text-muted-foreground"><th className="px-2 py-2 font-medium">Code</th><th className="px-2 py-2 font-medium">Status</th></tr></thead>
            <tbody>{state.results.map((result, index) => <tr className="border-b border-border last:border-0" key={`${result.code}:${index}`}>
              <th className="px-2 py-2 font-mono font-medium" scope="row">{result.code}</th><td className="px-2 py-2">{result.status.split('_').map((part) => part ? `${part[0]?.toLocaleUpperCase()}${part.slice(1)}` : '').join(' ') || 'Unknown'}</td>
            </tr>)}</tbody>
          </table></div>}
        <p className="text-base text-muted-foreground">{state.results.filter((result) => result.status === 'valid').length} of {state.results.length} codes are valid for this survey. {state.results.filter((result) => result.status === 'not_found').length} were not found.</p>
      </>}
    </CardContent>
  </Card>
}
