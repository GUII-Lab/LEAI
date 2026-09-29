import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { createStudentApi, type StudentDebug, type StudentSession, type StudentTurn } from '@/api/student'
import { ApiFailure } from '@/api/contracts/errors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { qualifyBrowserKey, toAppHref, type PublicEnvironment } from '@/config/environment'
import { StudentConversation } from './StudentConversation'
import { saveStudentPdfBlob } from './student-document'

type StudentApi = ReturnType<typeof createStudentApi>
type StoredSession = { sessionId: string; token: string }
type FingerprintRuntime = { load: () => Promise<{ get: () => Promise<{ visitorId: string }> }> }

function getOrCreateDeviceKey(): string {
  try {
    const existing = window.localStorage.getItem('leai_device_key')
    if (existing) return existing
    const key = window.crypto?.randomUUID?.() ?? `dk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem('leai_device_key', key)
    return key
  } catch {
    return ''
  }
}

function loadBrowserFingerprint(): Promise<string> {
  const browser = window as Window & { FingerprintJS?: FingerprintRuntime }
  const getVisitorId = async () => {
    try {
      return (await (await browser.FingerprintJS!.load()).get()).visitorId
    } catch {
      return ''
    }
  }
  if (browser.FingerprintJS) return getVisitorId()
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3.4.2/dist/fp.min.js'
    script.onload = () => { void getVisitorId().then(resolve) }
    script.onerror = () => resolve('')
    document.head.appendChild(script)
  })
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readStoredSession(key: string): StoredSession | null {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const linkedSession = fragment.get('session')
  const linkedToken = fragment.get('token')
  if (linkedSession && linkedToken && uuidPattern.test(linkedSession) && /^[0-9a-f]{64}$/i.test(linkedToken)) {
    const credential = { sessionId: linkedSession, token: linkedToken }
    sessionStorage.setItem(key, JSON.stringify(credential))
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    return credential
  }
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (value && typeof value === 'object' && 'sessionId' in value && 'token' in value
      && typeof value.sessionId === 'string' && uuidPattern.test(value.sessionId)
      && typeof value.token === 'string' && /^[0-9a-f]{64}$/i.test(value.token)) {
      return { sessionId: value.sessionId, token: value.token }
    }
  } catch { /* Ignore a malformed browser-only resume hint. */ }
  sessionStorage.removeItem(key)
  return null
}

function StudentDebugPanel({ snapshot }: { snapshot: StudentDebug }) {
  const state = snapshot.schema_state
  const collected = Object.entries(state.results)
  const evidence = Object.entries(state.evidence_seen).filter(([, seen]) => seen).map(([id]) => id)
  const nextAction = state.phase === 'probe' ? 'Follow-up pending' : state.phase === 'complete'
    ? 'Reflection complete' : state.phase === 'rating' ? 'Rating pending' : 'Answer pending'
  return <Card className="min-w-0 border border-border bg-muted/30">
    <CardHeader>
      <CardTitle>Recorded schema state</CardTitle>
      <p className="text-base text-muted-foreground">This shows saved decisions and answer links, not the AI’s private reasoning.</p>
    </CardHeader>
    <CardContent className="space-y-5 text-base">
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-background p-3 sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Current phase</dt><dd className="font-medium">{state.phase}</dd></div>
        <div><dt className="text-muted-foreground">Question index</dt><dd className="font-medium">{state.phase === 'complete' ? 'Complete' : state.item_index + 1}</dd></div>
        <div><dt className="text-muted-foreground">Saved turn</dt><dd className="font-medium">{snapshot.turn_version}</dd></div>
        <div><dt className="text-muted-foreground">Current decision</dt><dd className="font-medium">{nextAction}</dd></div>
      </dl>
      <section aria-label="Question results" className="space-y-2">
        <h3 className="font-semibold">Question results</h3>
        {collected.length === 0 ? <p className="text-muted-foreground">No answer recorded yet.</p> : collected.map(([id, result]) =>
          <div className="rounded-lg border border-border bg-background p-3" key={id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-semibold">{id}</span><span>{result.status}</span></div>
            <p className="text-muted-foreground">Rating: {result.rating ?? 'none'} · Follow-ups: {result.probes}</p>
            <p className="break-words text-muted-foreground">Covered targets: {state.coverage_seen[id]?.join(', ') || 'none recorded'}</p>
          </div>) }
      </section>
      <section aria-label="Collected evidence" className="space-y-2">
        <h3 className="font-semibold">Collected evidence</h3>
        <p className="break-words text-muted-foreground">Linked questions: {evidence.join(', ') || 'none recorded'}</p>
        {snapshot.responses.map((response) => <div className="rounded-lg border border-border bg-background p-3" key={response.sequence}>
          <p className="font-medium">{response.item_id} · {response.phase} → {response.next_item_id ? `${response.next_item_id} ` : ''}{response.next_phase ?? 'pending'}</p>
          <blockquote className="my-2 whitespace-pre-wrap break-words border-l-2 border-primary/40 pl-3">{response.content}</blockquote>
          <p className="break-words text-muted-foreground">Evidence for: {response.evidence_for.join(', ') || 'none'}</p>
          <p className="break-words text-muted-foreground">Targets in this answer: {response.covered_targets.join(', ') || 'none'}</p>
        </div>)}
      </section>
      <section aria-label="Answer mapping" className="space-y-2">
        <h3 className="font-semibold">Answer mapping</h3>
        {Object.entries(state.answer_map).length === 0 ? <p className="text-muted-foreground">No answers mapped yet.</p> :
          Object.entries(state.answer_map).map(([id, sequences]) => <div className="rounded-lg border border-border bg-background p-3" key={id}>
            <p className="font-semibold">{id}</p>
            <p className="text-muted-foreground">Saved student messages: {sequences.join(', ') || 'none'}</p>
          </div>)}
      </section>
      {state.orchestration && <section aria-label="Orchestration diagnostics" className="space-y-2">
        <h3 className="font-semibold">Orchestration diagnostics</h3>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background p-3 text-xs">{JSON.stringify(state.orchestration, null, 2)}</pre>
      </section>}
    </CardContent>
  </Card>
}

export function StudentSurveyPage({ api, environment, verified }: {
  api?: StudentApi
  environment: PublicEnvironment
  verified: boolean
}) {
  const surveyId = new URLSearchParams(window.location.search).get('id') ?? ''
  const validId = uuidPattern.test(surveyId)
  const storageKey = qualifyBrowserKey(environment.name, `student:${surveyId}`)
  const [stored, setStored] = useState<StoredSession | null>(() => validId ? readStoredSession(storageKey) : null)
  const [current, setCurrent] = useState<StudentSession | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const matchingSessions = useRef(new Set<string>())
  const activeApi = useMemo(() => api ?? createStudentApi(environment, () => verified), [api, environment, verified])
  const surveyQuery = useQuery({
    queryKey: ['student-survey', environment.name, surveyId],
    queryFn: () => activeApi.survey(surveyId),
    enabled: validId,
    retry: false,
  })
  const sessionQuery = useQuery({
    queryKey: ['student-session', environment.name, surveyId, stored?.sessionId],
    queryFn: () => activeApi.session(surveyId, stored!.sessionId, stored!.token),
    enabled: validId && Boolean(stored),
    retry: false,
  })
  const session = current ?? sessionQuery.data ?? null

  useEffect(() => {
    if (!surveyQuery.data?.anonymous_matching_enabled || !stored || !session) return
    if (matchingSessions.current.has(session.session_id)) return
    matchingSessions.current.add(session.session_id)
    let cancelled = false
    void loadBrowserFingerprint().then((fingerprint) => {
      if (cancelled) return
      void activeApi.matchingSignals(surveyId, stored.sessionId, stored.token, {
        device_key: getOrCreateDeviceKey(), fingerprint,
      }).catch(() => {})
    }).catch(() => {})
    return () => { cancelled = true }
  }, [activeApi, session?.session_id, stored?.sessionId, stored?.token, surveyQuery.data?.anonymous_matching_enabled, surveyId])
  const debugAllowed = verified && environment.name !== 'production'
  const debugAccessQuery = useQuery({
    queryKey: ['student-debug-access', environment.name, surveyId],
    queryFn: () => activeApi.debugAccess(surveyId),
    enabled: debugAllowed && validId,
    retry: false,
  })
  const debugQuery = useQuery({
    queryKey: ['student-debug', environment.name, surveyId, stored?.sessionId, session?.turn_version],
    queryFn: () => activeApi.debug(surveyId, stored!.sessionId),
    enabled: debugAllowed && debugAccessQuery.data?.enabled === true && showDebug && validId && Boolean(stored) && Boolean(session),
    retry: false,
  })

  async function start(researchConsent: boolean, teamId?: string) {
    if (!verified || busy || !validId) return
    setBusy(true)
    setError('')
    setConflict(false)
    try {
      const created = await activeApi.start(surveyId, {
        terms_consent: true, research_consent: researchConsent,
        ...(teamId ? { team_snapshot_item_id: teamId } : {}),
      })
      const credential = { sessionId: created.session_id, token: created.token }
      sessionStorage.setItem(storageKey, JSON.stringify(credential))
      setStored(credential)
      setCurrent(created)
    } catch {
      setError('Could not start this reflection. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verified || busy || !stored || !session || session.status !== 'active') return
    const prompt = session.prompt
    const turn: StudentTurn = {
      expected_version: session.turn_version,
      ...(prompt.phase !== 'complete' ? { item_id: prompt.item_id } : {}),
      kind: 'text', text: text.trim(),
    }
    if (!turn.text) return
    await sendTurn(turn)
  }

  async function sendTurn(turn: StudentTurn) {
    if (!stored || busy) return
    setBusy(true)
    setError('')
    setConflict(false)
    try {
      const updated = await activeApi.turn(surveyId, stored.sessionId, stored.token, turn)
      setCurrent(updated)
      setText('')
    } catch (cause) {
      if (cause instanceof ApiFailure && cause.kind === 'conflict') {
        setConflict(true)
        setError('This reflection changed in another tab. Load the latest question before continuing.')
      } else setError('Your answer was not sent. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function refreshSession() {
    if (!stored || busy) return
    setBusy(true)
    setError('')
    try {
      setCurrent(await activeApi.session(surveyId, stored.sessionId, stored.token))
      setText('')
      setConflict(false)
    } catch {
      setError('Could not restore your reflection. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function startNew() {
    sessionStorage.removeItem(storageKey)
    setStored(null)
    setCurrent(null)
    setError('')
    setConflict(false)
    setShowDebug(false)
  }

  async function copyResumeLink() {
    if (!stored) return
    const url = new URL(window.location.href)
    url.hash = new URLSearchParams({ session: stored.sessionId, token: stored.token }).toString()
    try {
      await navigator.clipboard.writeText(url.toString())
      setError('')
    } catch {
      setError('Could not copy the resume link. Please allow clipboard access and try again.')
    }
  }

  async function saveDraft() {
    if (!surveyQuery.data || !session || !stored) return
    setBusy(true)
    try {
      let finalized = session.prompt.phase === 'complete'
      if (finalized && session.status === 'active') {
        const current = await activeApi.finalize(surveyId, stored.sessionId, stored.token, session.turn_version)
        setCurrent(current)
      }
      const pdf = await activeApi.responsePdf(surveyId, stored.sessionId, stored.token)
      saveStudentPdfBlob(pdf, surveyQuery.data.label, finalized)
      setError('')
    } catch (cause) {
      if (cause instanceof ApiFailure && cause.kind === 'conflict') {
        setConflict(true)
        setError('This reflection changed in another tab. Load the latest version before downloading.')
      } else setError('Could not download the PDF. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!validId) return <main className="mx-auto max-w-2xl px-4 py-10"><h1 className="mb-4 text-2xl font-semibold">Reflection</h1><p role="alert">This survey link is invalid.</p></main>
  const survey = surveyQuery.data

  if (survey?.team_setup_required && !session) return <main className="flex min-h-dvh items-center justify-center px-5 text-center" role="status">
    Team setup is pending. Please return after your instructor adds the team labels.
  </main>

  if (surveyQuery.isPending || surveyQuery.isError || (!survey?.available && !session) || (stored && sessionQuery.isPending && !session)) {
    return <main className="flex min-h-dvh items-center justify-center px-5 text-center" role="status">
      {surveyQuery.isPending ? 'Loading survey…' : surveyQuery.isError ? 'This survey could not be loaded. Check the link or try again later.'
        : !survey?.available && !session ? 'This survey is not currently available.' : 'Restoring your reflection…'}
    </main>
  }
  if (sessionQuery.isError && !session) return <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5 text-center">
    <p role="alert">Could not restore your reflection.</p>
    <Button onClick={() => void refreshSession()} variant="outline">Retry restoring reflection</Button>
    {sessionQuery.error instanceof ApiFailure && sessionQuery.error.kind === 'not_found' &&
      <Button onClick={startNew} variant="outline">Start a new reflection</Button>}
  </main>

  return <StudentConversation survey={survey} session={session} text={text} onTextChange={setText}
    termsHref={toAppHref(environment, 'legal/terms.html')} privacyHref={toAppHref(environment, 'legal/privacy.html')}
    onSubmit={(event) => void submit(event)}
    onStart={(researchConsent, teamId) => void start(researchConsent, teamId)} onCopyResume={() => void copyResumeLink()} busy={busy} verified={verified} error={error}
    onDownloadDocument={() => void saveDraft()}
    conflictAction={conflict && <Button className="mt-2" onClick={() => void refreshSession()} type="button" variant="outline">Load latest question</Button>}
    debugDisclosure={debugAllowed && debugAccessQuery.data?.enabled === true && session && stored && <div className="mt-4 min-w-0" data-testid="inline-debug-disclosure">
      <Button aria-controls="student-debug-panel" aria-expanded={showDebug}
        className="h-8 gap-1.5 rounded-md px-2 text-xs text-muted-foreground" onClick={() => setShowDebug((open) => !open)} size="sm" type="button" variant="ghost">
        <ChevronDown aria-hidden="true" className={`size-3.5 transition-transform ${showDebug ? 'rotate-180' : ''}`} />
        {showDebug ? 'Hide debug state' : 'Show debug state'}
      </Button>
      <div aria-label="Recorded debug state" className="mt-2" hidden={!showDebug} id="student-debug-panel" role="region">
        {showDebug && (debugQuery.isPending ? <p role="status">Loading recorded state…</p> : debugQuery.isError ?
          <p role="alert">Could not load recorded state. Collapse and reopen to retry.</p> :
          debugQuery.data.session_id === session.session_id && debugQuery.data.turn_version === session.turn_version ?
            <StudentDebugPanel snapshot={debugQuery.data} /> : <p role="status">Refreshing recorded state…</p>)}
      </div>
    </div>}
  />
}
