import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, ClipboardCopy, FilePenLine, Plus } from 'lucide-react'
import { AuthenticationRequiredError, InstructorApiError, type createInstructorApi } from '@/api/instructor-v1'
import type {
  WizardConversationMessage, WizardDraft, WizardProtocol,
  WizardRevision, WizardSurvey, WizardTemplate, WizardVersion,
} from '@/api/contracts/wizard'
import { protocolSchema } from '@/api/contracts/wizard'
import { loginHref } from '@/auth/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { qualifyBrowserKey, toAppHref, type PublicEnvironment } from '@/config/environment'
import { ArtifactEditor } from './prompt-designer/ArtifactEditor'
import { AuthoringConversation } from './prompt-designer/AuthoringConversation'
import { BuilderFrame } from './prompt-designer/BuilderFrame'
import { PreviewStep } from './prompt-designer/PreviewStep'
import type { WizardStep } from './prompt-designer/WorkflowStepper'

type Api = ReturnType<typeof createInstructorApi>
type Audience = 'individual' | 'team'
type Style = 'guided' | 'open'

function errorText(error: unknown) {
  if (error instanceof InstructorApiError) {
    if (error.code === 'stale_draft') return 'This draft changed in another tab. Your text is still here. Copy it before reloading the saved version.'
    if (error.code === 'preview_required') return 'Complete or explicitly skip the preview for this revision before publishing.'
    if (error.code === 'authoring_in_progress') return 'An AI edit is already running for this draft.'
    return `Could not complete this action (${error.code}). Please try again.`
  }
  return 'Could not complete this action. Please try again.'
}

function elapsedSave(updatedAt: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(updatedAt)) / 1000))
  if (seconds < 45) return 'Saved just now'
  if (seconds < 3600) return `Saved ${Math.floor(seconds / 60)} min ago`
  return `Saved ${Math.floor(seconds / 3600)} hr ago`
}

function displayDateTime(value: string | null) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(timestamp)
}

export function PromptDesignerPage({ api, environment, verified }: {
  api: Api
  environment: PublicEnvironment
  verified: boolean
}) {
  const queryClient = useQueryClient()
  const courseId = sessionStorage.getItem(qualifyBrowserKey(environment.name, 'selected-course')) ?? ''
  const [builderOpen, setBuilderOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [step, setStep] = useState<WizardStep>(0)
  const [source, setSource] = useState<'leai' | 'my' | 'community' | 'scratch'>('leai')
  const [howOpen, setHowOpen] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [audience, setAudience] = useState<Audience>('individual')
  const [style, setStyle] = useState<Style>('guided')
  const [newTitle, setNewTitle] = useState('New feedback')
  const [draft, setDraft] = useState<WizardDraft | null>(null)
  const [body, setBody] = useState<WizardProtocol | null>(null)
  const [versions, setVersions] = useState<WizardVersion[]>([])
  const [conversation, setConversation] = useState<WizardConversationMessage[]>([])
  const [composer, setComposer] = useState('')
  const [aiJobId, setAiJobId] = useState('')
  const [revision, setRevision] = useState<WizardRevision | null>(null)
  const [previewOpened, setPreviewOpened] = useState(false)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateSaveStatus, setTemplateSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [templateSaveError, setTemplateSaveError] = useState('')
  const [publishLabel, setPublishLabel] = useState('')
  const [publishedSurvey, setPublishedSurvey] = useState<WizardSurvey | null>(null)
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [certificateEnabled, setCertificateEnabled] = useState(false)
  const [downloadEnabled, setDownloadEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [highlightId, setHighlightId] = useState('')
  const [surveyFilter, setSurveyFilter] = useState<'all' | 'individual' | 'team'>('all')
  const [individualStyleFilter, setIndividualStyleFilter] = useState<'all' | Style>('all')
  const [teamSurvey, setTeamSurvey] = useState<WizardSurvey | null>(null)
  const [teamLabels, setTeamLabels] = useState('')
  const bodyRef = useRef<WizardProtocol | null>(null)
  const versionRef = useRef(0)
  const dirtyRef = useRef(false)
  const savingRef = useRef<Promise<void> | null>(null)
  const draftIdRef = useRef('')
  const templateSaveRequestRef = useRef('')
  const templateSaveKeyRef = useRef('')
  const publishRequestRef = useRef('')
  const publishKeyRef = useRef('')

  const coursesQuery = useQuery({
    queryKey: ['wizard-courses', environment.name],
    queryFn: ({ signal }) => api.courses(signal),
    enabled: verified,
    retry: false,
  })
  const course = coursesQuery.data?.courses.find((row) => row.course_id === courseId)
  const canAuthor = course?.allowed_actions.includes('feedback.author') ?? false
  const canPublish = course?.allowed_actions.includes('feedback.publish') ?? false
  const draftsQuery = useQuery({
    queryKey: ['wizard-drafts', courseId],
    queryFn: ({ signal }) => api.wizardDrafts(courseId, signal),
    enabled: verified && !!courseId && canAuthor,
    retry: false,
  })
  const templatesQuery = useQuery({
    queryKey: ['wizard-templates', courseId],
    queryFn: ({ signal }) => api.wizardTemplates(courseId, signal),
    enabled: verified && !!courseId && canAuthor,
    retry: false,
  })
  const surveysQuery = useQuery({
    queryKey: ['wizard-surveys', courseId],
    queryFn: ({ signal }) => api.wizardSurveys(courseId, signal),
    enabled: verified && !!courseId && canAuthor,
    retry: false,
  })
  const latestDraft = draftsQuery.data?.question_sets.find((row) => row.resumable)
  const surveys = surveysQuery.data?.surveys ?? []
  const visibleSurveys = surveys.filter((row) =>
    (surveyFilter === 'all' || row.audience === surveyFilter) &&
    (surveyFilter !== 'individual' || individualStyleFilter === 'all' || row.collection_style === individualStyleFilter),
  )
  const templates = templatesQuery.data?.templates ?? []
  const visibleTemplates = templates.filter((row) => row.source === source && row.audience === audience && row.collection_style === style)

  useEffect(() => {
    if (step !== 3 || !revision || !courseId) return
    let active = true
    const refresh = () => {
      void api.wizardRevision(courseId, revision.id).then((updated) => {
        if (active && updated.id === revision.id) setRevision(updated)
      }).catch(() => { /* The existing revision stays visible until a later refresh. */ })
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === 'leai:wizard-preview-completed' && event.data.revisionId === revision.id) refresh()
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('message', onMessage)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener('message', onMessage)
    }
  }, [api, courseId, revision?.id, step])

  useEffect(() => {
    if (!highlightId) return
    const card = document.getElementById(`survey-${highlightId}`)
    if (!card) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    card.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
    card.focus({ preventScroll: true })
    const timeout = window.setTimeout(() => setHighlightId((current) => current === highlightId ? '' : current), 3500)
    return () => window.clearTimeout(timeout)
  }, [highlightId, surveys])

  const handleError = useCallback((cause: unknown) => {
    if (cause instanceof AuthenticationRequiredError) {
      sessionStorage.removeItem(qualifyBrowserKey(environment.name, 'selected-course'))
      window.location.replace(loginHref(environment, window.location.pathname))
      return
    }
    setError(errorText(cause))
  }, [environment])

  const resetBuilder = () => {
    setBuilderOpen(false)
    setDraft(null)
    setBody(null)
    bodyRef.current = null
    draftIdRef.current = ''
    dirtyRef.current = false
    setRevision(null)
    setPublishedSurvey(null)
    setPreviewOpened(false)
    setAiJobId('')
    setError('')
  }

  const loadDraft = useCallback(async (id: string) => {
    const [loaded, history, chat] = await Promise.all([
      api.wizardDraft(courseId, id), api.wizardVersions(courseId, id), api.wizardConversation(courseId, id),
    ])
    setDraft(loaded)
    setAudience(loaded.audience)
    setStyle(loaded.collection_style)
    setPublishLabel(loaded.title)
    draftIdRef.current = loaded.id
    versionRef.current = loaded.draft_version
    bodyRef.current = loaded.body
    dirtyRef.current = false
    setBody(loaded.body)
    setVersions(history.versions)
    setConversation(chat.messages)
    setSaveStatus(elapsedSave(loaded.updated_at))
    return loaded
  }, [api, courseId])

  const saveNow = useCallback(async function flushSave(): Promise<void> {
    if (savingRef.current) {
      await savingRef.current
      if (dirtyRef.current) return flushSave()
      return
    }
    const current = bodyRef.current
    const id = draftIdRef.current
    if (!dirtyRef.current || !current || !id) return
    const payload = current
    if (!protocolSchema.safeParse(payload).success) {
      setSaveStatus('Complete required fields to save')
      throw new Error('invalid_draft')
    }
    const expected = versionRef.current
    dirtyRef.current = false
    setSaveStatus('Saving…')
    const promise = api.saveWizardDraft(courseId, id, expected, payload, crypto.randomUUID()).then((saved) => {
      versionRef.current = saved.draft_version
      setDraft(saved)
      if (bodyRef.current === payload) {
        bodyRef.current = saved.body
        setBody(saved.body)
      } else {
        dirtyRef.current = true
      }
      setSaveStatus('Saved just now')
      void queryClient.invalidateQueries({ queryKey: ['wizard-drafts', courseId] })
      void api.wizardVersions(courseId, id).then((result) => setVersions(result.versions))
    }).catch((cause: unknown) => {
      dirtyRef.current = true
      setSaveStatus('Not saved')
      handleError(cause)
      throw cause
    }).finally(() => { savingRef.current = null })
    savingRef.current = promise
    await promise
    if (dirtyRef.current && bodyRef.current !== payload) await flushSave()
  }, [api, courseId, handleError, queryClient])

  useEffect(() => {
    if (!builderOpen || !draft || !body || !dirtyRef.current) return
    const timer = window.setTimeout(() => { void saveNow().catch(() => {}) }, 1200)
    return () => window.clearTimeout(timer)
  }, [body, builderOpen, draft, saveNow])

  useEffect(() => {
    if (!aiJobId || !draft || !builderOpen) return
    let active = true
    const timer = window.setInterval(() => {
      void api.job(courseId, aiJobId).then(async (job) => {
        if (!active || job.status === 'pending' || job.status === 'running') return
        window.clearInterval(timer)
        setAiJobId('')
        if (job.status === 'completed') {
          if (!dirtyRef.current) await loadDraft(draft.id)
          else setConversation((await api.wizardConversation(courseId, draft.id)).messages)
          setNotice('LEAI updated the saved draft.')
        } else {
          setError(job.error_code === 'stale_draft'
            ? 'The draft changed while LEAI was working. Your manual edits were preserved.'
            : job.error_code === 'provider_outcome_unknown'
              ? 'LEAI could not confirm whether its AI request finished. Review the saved draft before sending the instruction again.'
              : 'LEAI could not update this draft. Please try again.')
          setConversation((await api.wizardConversation(courseId, draft.id)).messages)
        }
      }).catch(handleError)
    }, 1200)
    return () => { active = false; window.clearInterval(timer) }
  }, [aiJobId, api, builderOpen, courseId, draft, handleError, loadDraft])

  const editBody = (next: WizardProtocol) => {
    bodyRef.current = next
    dirtyRef.current = true
    setBody(next)
    setSaveStatus('Saving…')
    setError('')
  }

  async function continueDraft() {
    if (!latestDraft) return
    setError('')
    setBusy(true)
    try {
      await loadDraft(latestDraft.id)
      setStep(2)
      setBuilderOpen(true)
    } catch (cause) { handleError(cause) }
    finally { setBusy(false) }
  }

  async function createDraft() {
    setBusy(true)
    setError('')
    try {
      const selected = templates.find((item) => item.id === templateId)
      const created = await api.createWizardDraft(courseId, {
        title: newTitle.trim() || 'New feedback',
        audience, collection_style: style,
        ...(selected && selected.audience === audience && selected.collection_style === style ? { template_id: selected.id } : {}),
      }, crypto.randomUUID())
      await loadDraft(created.id)
      setPublishLabel(created.title)
      setStep(2)
    } catch (cause) { handleError(cause) }
    finally { setBusy(false) }
  }

  async function sendAi() {
    if (!draft || !composer.trim()) return
    setError('')
    try {
      await saveNow()
      const result = await api.startWizardAi(courseId, draft.id, composer.trim(), versionRef.current, crypto.randomUUID())
      setComposer('')
      setAiJobId(result.job_id)
      setConversation((await api.wizardConversation(courseId, draft.id)).messages)
    } catch (cause) { handleError(cause) }
  }

  async function restoreVersion(version: WizardVersion) {
    if (!draft) return
    setError('')
    try {
      await saveNow()
      await api.restoreWizardVersion(courseId, draft.id, versionRef.current, version.id, crypto.randomUUID())
      await loadDraft(draft.id)
      setNotice(`Restored version ${version.number} as a new saved version.`)
    } catch (cause) { handleError(cause) }
  }

  async function toPreview() {
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      await saveNow()
      const frozen = await api.freezeWizardDraft(courseId, draft.id, versionRef.current)
      setRevision(frozen.revision)
      setPreviewOpened(false)
      setStep(3)
    } catch (cause) { handleError(cause) }
    finally { setBusy(false) }
  }

  function launchPreview() {
    if (!revision) return
    const href = toAppHref(environment, `WizardPreview.html?revision=${encodeURIComponent(revision.id)}`)
    const opened = window.open(href, '_blank')
    if (!opened) { setError('Your browser blocked the preview tab. Allow pop-ups for this site and try again.'); return }
    setPreviewOpened(true)
  }

  async function decidePreview(decision: 'completed' | 'skipped') {
    if (!revision) return
    setPreviewBusy(true)
    try { setRevision(await api.decideWizardPreview(courseId, revision.id, decision, crypto.randomUUID())) }
    catch (cause) { handleError(cause) }
    finally { setPreviewBusy(false) }
  }

  async function publish() {
    if (!revision || !canPublish) return
    const payload = {
      label: publishLabel.trim() || revision.body.title,
      opens_at: opensAt ? new Date(opensAt).toISOString() : null,
      closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      completion_certificate_enabled: certificateEnabled,
      completed_response_download_enabled: downloadEnabled,
    }
    const requestIdentity = JSON.stringify([courseId, revision.id, payload])
    if (publishRequestRef.current !== requestIdentity) {
      publishRequestRef.current = requestIdentity
      publishKeyRef.current = crypto.randomUUID()
    }
    setBusy(true)
    setError('')
    try {
      const published = await api.publishWizard(courseId, revision.id, payload, publishKeyRef.current)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wizard-surveys', courseId] }),
        queryClient.invalidateQueries({ queryKey: ['wizard-drafts', courseId] }),
      ])
      publishRequestRef.current = ''
      publishKeyRef.current = ''
      setPublishedSurvey(published)
    } catch (cause) { handleError(cause) }
    finally { setBusy(false) }
  }

  function completePublication() {
    if (!publishedSurvey) return
    const publishedId = publishedSurvey.id
    resetBuilder()
    setSurveyFilter('all')
    setIndividualStyleFilter('all')
    setHighlightId(publishedId)
  }

  async function saveTemplate() {
    if (!revision) return
    const title = templateName.trim()
    if (!title) {
      setTemplateSaveError('Enter a template name.')
      setTemplateSaveStatus('error')
      return
    }
    const requestIdentity = JSON.stringify([courseId, revision.id, title])
    if (templateSaveRequestRef.current !== requestIdentity) {
      templateSaveRequestRef.current = requestIdentity
      templateSaveKeyRef.current = crypto.randomUUID()
    }
    setTemplateSaveError('')
    setTemplateSaveStatus('saving')
    try {
      await api.saveWizardTemplate(courseId, revision.id, title, templateSaveKeyRef.current)
      await queryClient.invalidateQueries({ queryKey: ['wizard-templates', courseId] })
      setTemplateSaveStatus('saved')
    } catch (cause) {
      setTemplateSaveError(errorText(cause))
      setTemplateSaveStatus('error')
    }
  }

  async function copyLink(survey: WizardSurvey) {
    try {
      await navigator.clipboard.writeText(new URL(toAppHref(environment, survey.direct_url), window.location.href).href)
      setNotice(survey.team_setup_required
        ? 'Link copied. Set up teams before students can begin.' : 'Link copied.')
    } catch { setError('Could not copy the link. Please try again.') }
  }

  async function createRevisedVersion(survey: WizardSurvey) {
    if (busy || !survey.allowed_actions.includes('create_revised_version')) return
    setError('')
    setBusy(true)
    try {
      const revisedDraft = await api.reviseWizardSurvey(courseId, survey.id, crypto.randomUUID())
      await queryClient.invalidateQueries({ queryKey: ['wizard-drafts', courseId] })
      await loadDraft(revisedDraft.id)
      setRevision(null)
      setStep(2)
      setBuilderOpen(true)
      setNotice(`Created a new draft from “${survey.label}”. The published survey and its responses are unchanged.`)
    } catch (cause) { handleError(cause) }
    finally { setBusy(false) }
  }

  async function setupTeams() {
    if (!teamSurvey) return
    const labels = teamLabels.split('\n').map((value) => value.trim()).filter(Boolean)
    if (!labels.length || labels.length > 30 || new Set(labels.map((value) => value.toLocaleLowerCase())).size !== labels.length) {
      setError('Enter 1 to 30 distinct team names, one per line.')
      return
    }
    setBusy(true)
    try {
      await api.setupWizardTeams(courseId, teamSurvey.id, labels, crypto.randomUUID())
      await queryClient.invalidateQueries({ queryKey: ['wizard-surveys', courseId] })
      setTeamSurvey(null)
      setTeamLabels('')
      setNotice('Teams are ready. Students can now choose their team from the survey link.')
    } catch (cause) { handleError(cause) }
    finally { setBusy(false) }
  }

  function footer() {
    if (publishedSurvey) return <Button className="ml-auto" disabled={busy} onClick={completePublication} type="button">
      Complete / Return to surveys<ArrowRight className="size-4" />
    </Button>
    const back = <Button disabled={busy || step === 0} onClick={() => setStep((step - 1) as WizardStep)} type="button" variant="outline">
      <ArrowLeft className="size-4" />Back
    </Button>
    const next = step === 0
      ? <Button onClick={() => setStep(1)} type="button">Continue<ArrowRight className="size-4" /></Button>
      : step === 1
        ? <Button disabled={busy || (audience === 'team' && style === 'open')} onClick={() => {
          if (draft) setStep(2)
          else void createDraft()
        }} type="button">
          {busy ? 'Creating…' : 'Continue'}<ArrowRight className="size-4" />
        </Button>
        : step === 2
          ? <Button disabled={busy || !body} onClick={() => { void toPreview() }} type="button">
            {busy ? 'Saving…' : 'Continue to preview'}<ArrowRight className="size-4" />
          </Button>
          : step === 3
            ? <Button disabled={!revision?.preview_decision || previewBusy} onClick={() => setStep(4)} type="button">
              Continue to publish<ArrowRight className="size-4" />
            </Button>
            : <Button disabled={busy || !canPublish || !revision?.preview_decision} onClick={() => { void publish() }} type="button">
              {busy ? 'Publishing…' : 'Publish feedback'}
            </Button>
    return <>{back}{next}</>
  }

  if (coursesQuery.isLoading) return <p role="status">Loading course…</p>
  if (!course) return <p role="alert">This course is unavailable.</p>
  if (!canAuthor) return <p role="alert">You do not have permission to design feedback for this course.</p>

  return <section className="space-y-6" aria-label="Prompt Designer">
    {notice && !builderOpen && <p aria-live="polite" className="rounded-lg border border-border bg-muted/50 p-3 text-base">{notice}</p>}
    {error && !builderOpen && <p role="alert" className="text-destructive">{error}</p>}
    <div className="grid min-w-0 items-start gap-7 md:grid-cols-2">
      <Card className="min-w-0 rounded-none border-0 bg-card py-7 shadow-none ring-0">
        <CardHeader className="px-7"><CardTitle className="text-sm font-bold tracking-widest text-muted-foreground uppercase">Feedback Builder</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <p className="rounded-sm bg-muted px-4 py-3 text-base text-muted-foreground">Create guided or open feedback for individual students, or guided feedback for teams.</p>
          <p className="text-sm text-muted-foreground">{latestDraft ? 'Your latest unfinished setup is ready to continue. Published feedback appears on the right.' : `Start a new feedback experience for ${course.course_name}. Published feedback appears on the right.`}</p>
          <Button disabled={!verified} onClick={() => {
            setError(''); setNotice(''); setStep(0); setDraft(null); setBody(null)
            setTemplateId(''); setSource('leai'); setAudience('individual'); setStyle('guided')
            setRevision(null); setPublishedSurvey(null); setPreviewOpened(false); setNewTitle('New feedback'); setBuilderOpen(true)
          }} className="legacy-prompt-create" type="button"><Plus className="size-4" />Create new feedback</Button>
          {latestDraft && <div className="rounded-lg border border-border p-4">
            <p className="font-medium">{latestDraft.title}</p>
            <p className="text-sm text-muted-foreground">{latestDraft.audience} · {latestDraft.collection_style} · {elapsedSave(latestDraft.updated_at)}</p>
            <Button className="mt-3" disabled={busy} onClick={() => { void continueDraft() }} type="button" variant="outline">
              <FilePenLine className="size-4" />Continue previous session
            </Button>
          </div>}
          {draftsQuery.isError && <p role="alert">Could not load saved drafts. Retry by reloading the page.</p>}
        </CardContent>
      </Card>
      <Card className="min-w-0 rounded-none border-0 bg-card py-7 shadow-none ring-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 px-7"><CardTitle className="text-sm font-bold tracking-widest text-muted-foreground uppercase">Your Feedback Surveys</CardTitle><Button onClick={() => { void surveysQuery.refetch() }} size="sm" type="button" variant="outline">Refresh</Button></CardHeader>
        <CardContent>
          <div aria-label="Survey filter" className="mb-4 flex flex-wrap gap-2" role="group">
            {(['all', 'individual', 'team'] as const).map((filter) => <Button aria-pressed={surveyFilter === filter}
              key={filter} onClick={() => {
                setSurveyFilter(filter)
                if (filter !== 'individual') setIndividualStyleFilter('all')
              }} size="sm" type="button" variant={surveyFilter === filter ? 'default' : 'outline'}>
              {filter === 'all' ? 'All' : filter === 'individual' ? 'Individual' : 'Team'}
            </Button>)}
          </div>
          {surveyFilter === 'individual' && <div aria-label="Individual survey format" className="mb-4 flex flex-wrap gap-2" role="group">
            {(['all', 'guided', 'open'] as const).map((filter) => <Button aria-pressed={individualStyleFilter === filter}
              key={filter} onClick={() => setIndividualStyleFilter(filter)} size="sm" type="button" variant={individualStyleFilter === filter ? 'secondary' : 'ghost'}>
              {filter === 'all' ? 'All individual' : filter === 'guided' ? 'Guided' : 'Open'}
            </Button>)}
          </div>}
          {surveysQuery.isLoading ? <p role="status">Loading surveys…</p>
            : surveysQuery.isError ? <p role="alert">Could not load surveys.</p>
              : visibleSurveys.length === 0 ? <p className="py-8 text-center text-base text-muted-foreground">
                {surveyFilter === 'all' ? 'No published feedback yet. Create one on the left.'
                  : surveyFilter === 'team' ? 'No team feedback yet.'
                    : individualStyleFilter === 'all' ? 'No individual feedback yet.'
                      : `No ${individualStyleFilter} individual feedback yet.`}
              </p>
                : <ul className="divide-y divide-border">{visibleSurveys.map((survey) => {
                  const surveyType = survey.audience === 'team' ? 'Team Guided'
                    : survey.collection_style === 'guided' ? 'Individual Guided' : 'Individual Open'
                  const tint = survey.audience === 'team' ? 'border-l-success bg-success/5'
                    : survey.collection_style === 'guided' ? 'border-l-primary bg-primary/5' : 'border-l-info bg-info/5'
                  const surveyHref = new URL(toAppHref(environment, survey.direct_url), window.location.href).href
                  const opensLabel = displayDateTime(survey.opens_at)
                  const closesLabel = displayDateTime(survey.closes_at)
                  return <li className={`border-l-4 px-4 py-5 ${tint} ${highlightId === survey.id ? 'ring-2 ring-primary ring-inset' : ''}`}
                  id={`survey-${survey.id}`} key={survey.id} tabIndex={-1}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-primary">{survey.label}</p>
                        <span className="inline-flex rounded-full border border-current/20 px-2 py-0.5 text-xs font-medium">{surveyType}</span>
                      </div>
                      <p className="text-sm capitalize text-muted-foreground">{survey.state} · {survey.response_count} {survey.response_count === 1 ? 'response' : 'responses'}</p>
                      {(opensLabel || closesLabel) && <p className="mt-1 text-sm text-muted-foreground">
                        {opensLabel && <span>Opens {opensLabel}</span>}
                        {opensLabel && closesLabel && <span> · </span>}
                        {closesLabel && <span>Closes {closesLabel}</span>}
                      </p>}
                      {survey.team_setup_required && <p className="mt-1 text-sm text-amber-700">Team setup required</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {survey.team_setup_required && <Button onClick={() => { setError(''); setTeamSurvey(survey) }} type="button" variant="outline">Set up teams</Button>}
                      {survey.allowed_actions.includes('create_revised_version') && <Button disabled={busy} onClick={() => { void createRevisedVersion(survey) }} type="button" variant="outline">
                        <FilePenLine className="size-4" />Create revised version
                      </Button>}
                      {survey.allowed_actions.includes('copy_link') && <Button onClick={() => { void copyLink(survey) }} type="button" variant="outline">
                        <ClipboardCopy className="size-4" />Copy link
                      </Button>}
                      <a className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        href={surveyHref} rel="noreferrer" target="_blank">Open survey</a>
                    </div>
                  </div>
                </li>})}</ul>}
        </CardContent>
      </Card>
    </div>

    <Dialog onOpenChange={(open) => { if (!open) setTeamSurvey(null) }} open={!!teamSurvey}>
      <DialogContent>
        <DialogHeader><DialogTitle>Set up teams</DialogTitle>
          <DialogDescription>Add the team names students will choose from. One name per line.</DialogDescription></DialogHeader>
        <Textarea aria-label="Team names" maxLength={6000} onChange={(event) => setTeamLabels(event.target.value)} rows={8} value={teamLabels} />
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <DialogFooter><Button disabled={busy} onClick={() => { void setupTeams() }} type="button">Save teams</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    {builderOpen && <BuilderFrame footer={footer()} onClose={() => {
      if (publishedSurvey) completePublication()
      else setCloseOpen(true)
    }} step={step} title={draft?.title ?? 'Feedback Builder'}>
      {notice && <p aria-live="polite" className="mb-4 rounded-lg border border-border bg-muted/50 p-3 text-base">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">{error}</p>}
      {step === 0 && <div className="mx-auto max-w-4xl space-y-6">
        <div><p className="text-sm font-extrabold tracking-widest text-primary">Step 1</p>
          <h3 className="mt-1 text-3xl font-semibold tracking-tight">Who are you collecting feedback from?</h3>
          <p className="mt-2 text-base text-muted-foreground">Choose the purpose. Neither option is preferred over the other.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['individual', 'team'] as const).map((value) => <label className={`flex cursor-pointer items-start gap-4 rounded-xl border bg-card p-5 hover:border-primary ${audience === value ? 'border-primary ring-2 ring-primary/10' : 'border-border'}`} key={value}>
            <input checked={audience === value} className="sr-only" disabled={!!draft} name="wizard-audience" onChange={() => {
              setAudience(value); setTemplateId(''); if (value === 'team') setStyle('guided')
            }} type="radio" value={value} />
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-xl font-bold text-secondary-foreground">{value === 'individual' ? 'I' : 'T'}</span>
            <span><strong className="block text-lg">{value === 'individual' ? 'Individual feedback' : 'Team feedback'}</strong>
              <span className="mt-1 block text-base leading-relaxed text-muted-foreground">{value === 'individual' ? 'Collect each student’s own learning experience, needs, and suggestions.' : 'Collect private feedback about collaboration inside the team each student selects.'}</span></span>
          </label>)}
        </div>
        <div className="text-center"><Button onClick={() => setHowOpen(!howOpen)} type="button" variant="link">How LEAI works</Button></div>
        {howOpen && <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="text-lg font-semibold">How LEAI works</h4>
          <ol className="mt-4 grid gap-3 text-base sm:grid-cols-4">{['Choose a purpose', 'Select a starting point', 'Design together', 'Preview and publish'].map((label, index) => <li className="rounded-lg bg-muted p-3" key={label}><span className="mr-2 font-bold text-primary">{index + 1}.</span>{label}</li>)}</ol>
        </div>}
      </div>}
      {step === 1 && <div className="mx-auto max-w-4xl space-y-6">
        <div><p className="text-sm font-extrabold tracking-widest text-primary">Step 2</p>
          <h3 className="mt-1 text-3xl font-semibold tracking-tight">How should the conversation work?</h3>
          <p className="mt-2 text-base text-muted-foreground">Both paths open the same editable workspace.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['guided', 'open'] as const).map((value) => <label className={`flex cursor-pointer items-start gap-4 rounded-xl border bg-card p-5 hover:border-primary ${style === value ? 'border-primary ring-2 ring-primary/10' : 'border-border'} ${audience === 'team' && value === 'open' ? 'opacity-50' : ''}`} key={value}>
            <input checked={style === value} className="sr-only" disabled={!!draft || (audience === 'team' && value === 'open')} name="wizard-style" onChange={() => { setStyle(value); setTemplateId('') }} type="radio" value={value} />
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-xl font-bold text-secondary-foreground">{value === 'guided' ? 'G' : 'O'}</span>
            <span><strong className="block text-lg">{value === 'guided' ? 'Guided feedback' : 'Open conversation'}</strong>
              <span className="mt-1 block text-base leading-relaxed text-muted-foreground">{value === 'guided' ? 'Every student encounters a planned set of questions and optional follow-ups.' : 'Set one opening question and a listening goal, then follow what the student raises.'}</span></span>
          </label>)}
        </div>
        <label className="block space-y-2"><span className="font-medium">Working title</span>
          <Input maxLength={200} onChange={(event) => setNewTitle(event.target.value)} value={newTitle} /></label>
        <div><h4 className="text-lg font-semibold">Choose a starting point</h4><p className="text-base text-muted-foreground">You can edit every question after opening the Builder.</p></div>
        <Tabs onValueChange={(value) => { setSource(value as typeof source); setTemplateId('') }} value={source}>
          <TabsList className="h-auto w-full flex-wrap justify-start border-b border-border bg-transparent" variant="line">
            <TabsTrigger value="leai">LEAI</TabsTrigger><TabsTrigger value="my">My templates</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger><TabsTrigger value="scratch">Start from scratch</TabsTrigger>
          </TabsList>
          {(['leai', 'my', 'community'] as const).map((kind) => <TabsContent className="min-h-56 pt-4" key={kind} value={kind}>
            {templatesQuery.isLoading ? <p role="status">Loading templates…</p>
              : visibleTemplates.length ? <div className="grid gap-3 sm:grid-cols-2">{visibleTemplates.map((template: WizardTemplate) =>
                <button aria-pressed={templateId === template.id} className={`min-w-0 rounded-xl border bg-card p-5 text-left hover:border-primary/60 ${templateId === template.id ? 'border-primary ring-2 ring-primary/10' : 'border-border'}`}
                  key={template.id} onClick={() => {
                    setTemplateId(template.id); setNewTitle(template.name)
                  }} type="button">
                  <strong className="block">{template.name}</strong>
                  <span className="mt-1 block text-sm text-muted-foreground">{template.description || 'Saved question set'}</span>
                </button>)}</div> : <p className="text-muted-foreground">No templates in this collection yet. Start from scratch or choose LEAI.</p>}
          </TabsContent>)}
          <TabsContent className="min-h-56 pt-4" value="scratch">
            <p className="rounded-xl border border-border bg-card p-5">Start with one editable question and add sections as you design.</p>
          </TabsContent>
        </Tabs>
        {audience === 'team' && <p className="text-sm text-muted-foreground">Team feedback currently uses Guided feedback.</p>}
        {draft && <p className="text-sm text-muted-foreground">The audience and format are fixed for this draft. Create a new draft to change them.</p>}
      </div>}
      {step === 2 && body && <div className="grid min-w-0 gap-0 overflow-hidden rounded-xl border border-border bg-card xl:h-[min(38rem,calc(100dvh-18rem))] xl:min-h-[30rem] xl:grid-cols-[minmax(17rem,34%)_minmax(0,66%)]">
        <AuthoringConversation busy={!!aiJobId} disabled={!draft} messages={conversation} onSend={() => { void sendAi() }}
          onValueChange={setComposer} value={composer} />
        <div className="min-w-0 bg-card p-4 xl:h-full xl:overflow-y-auto xl:p-5"><ArtifactEditor body={body} collectionStyle={draft?.collection_style ?? 'guided'} disabled={false} onChange={editBody} onRestore={(version) => { void restoreVersion(version) }}
          saveStatus={saveStatus} versions={versions} /></div>
      </div>}
      {step === 3 && revision && <PreviewStep busy={previewBusy}
        onDecision={(decision) => { void decidePreview(decision) }} onLaunch={() => { void launchPreview() }}
        previewOpened={previewOpened} revision={revision} certificateEnabled={certificateEnabled} downloadEnabled={downloadEnabled}
        onCertificateChange={setCertificateEnabled} onDownloadChange={setDownloadEnabled} />}
      {step === 4 && publishedSurvey && <div aria-live="polite" className="mx-auto max-w-3xl rounded-xl border border-success/30 bg-success/5 p-8 text-center">
        <h3 className="text-2xl font-semibold">Feedback published</h3>
        <p className="mt-3 text-base text-muted-foreground"><span className="font-medium text-foreground">{publishedSurvey.label}</span> is published. Return to the survey list to review the new card and copy its link.</p>
      </div>}
      {step === 4 && revision && !publishedSurvey && <div className="mx-auto max-w-5xl space-y-5">
        <div><h3 className="text-xl font-semibold">Publish feedback</h3>
          <p className="mt-1 text-base text-muted-foreground">Publish this exact revision. Its questions will remain unchanged for students.</p></div>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(17.5rem,0.8fr)]"><div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <label className="block space-y-2"><span className="font-medium">Survey label</span>
          <Input maxLength={200} onChange={(event) => setPublishLabel(event.target.value)} value={publishLabel} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2"><span className="font-medium">Opens at (optional)</span>
            <Input onChange={(event) => setOpensAt(event.target.value)} type="datetime-local" value={opensAt} /></label>
          <label className="block space-y-2"><span className="font-medium">Closes at (optional)</span>
            <Input onChange={(event) => setClosesAt(event.target.value)} type="datetime-local" value={closesAt} /></label>
        </div>
        </div><aside className="rounded-xl border border-border bg-card p-5"><p className="text-sm font-bold tracking-widest text-primary uppercase">Publication summary</p><dl className="mt-3 divide-y divide-border text-base"><div className="py-3"><dt className="text-sm font-bold text-muted-foreground uppercase">Audience</dt><dd>{audience === 'team' ? 'Team members' : 'Individual students'}</dd></div><div className="py-3"><dt className="text-sm font-bold text-muted-foreground uppercase">Format</dt><dd>{style === 'open' ? 'Open conversation' : 'Guided feedback'}</dd></div><div className="py-3"><dt className="text-sm font-bold text-muted-foreground uppercase">Preview</dt><dd>{revision.preview_decision}</dd></div><div className="py-3"><dt className="text-sm font-bold text-muted-foreground uppercase">Outputs</dt><dd>Certificate {certificateEnabled ? 'on' : 'off'} · response form {downloadEnabled ? 'on' : 'off'}</dd></div></dl></aside></div>
        {audience === 'team' && <p className="text-sm text-muted-foreground">You can publish now and set up teams from the survey card before students begin.</p>}
        <Dialog open={templateDialogOpen} onOpenChange={(open) => {
          setTemplateDialogOpen(open)
          if (open) {
            setTemplateName(revision.body.title)
            setTemplateSaveStatus('idle')
            setTemplateSaveError('')
          }
        }}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">Save as My template</Button>
          </DialogTrigger>
      <DialogContent className="legacy-builder-theme sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Save as My template</DialogTitle>
              <DialogDescription>Save this exact revision privately to My templates. It will not be shared with the community.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); void saveTemplate() }}>
              <label className="block space-y-2">
                <span className="font-medium">Template name</span>
                <Input aria-invalid={templateSaveStatus === 'error'} aria-required="true" maxLength={200} onChange={(event) => {
                  setTemplateName(event.target.value)
                  setTemplateSaveStatus('idle')
                  setTemplateSaveError('')
                }} value={templateName} />
              </label>
              {templateSaveStatus === 'saving' && <p className="text-sm text-muted-foreground" role="status">Saving privately…</p>}
              {templateSaveStatus === 'saved' && <p className="text-sm text-success" role="status">Saved privately to My templates.</p>}
              {templateSaveStatus === 'error' && <p className="text-sm text-destructive" role="alert">{templateSaveError}</p>}
              <DialogFooter>
                {templateSaveStatus === 'saved'
                  ? <DialogClose asChild><Button type="button">Done</Button></DialogClose>
                  : <>
                    <DialogClose asChild><Button disabled={templateSaveStatus === 'saving'} type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button disabled={templateSaveStatus === 'saving'} type="submit">{templateSaveStatus === 'saving' ? 'Saving…' : 'Save template'}</Button>
                  </>}
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>}
    </BuilderFrame>}

    <AlertDialog onOpenChange={setCloseOpen} open={closeOpen}>
      <AlertDialogContent className="legacy-builder-theme">
        <AlertDialogHeader><AlertDialogTitle>Leave the Builder?</AlertDialogTitle>
          <AlertDialogDescription>Saved draft work will be available from Prompt Designer. Recent edits will be saved before closing.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            void saveNow().then(() => { resetBuilder(); setCloseOpen(false) }).catch(() => setCloseOpen(false))
          }}>Save and close</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
}
