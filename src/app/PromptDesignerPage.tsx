import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, ClipboardCopy, FilePenLine, Plus } from 'lucide-react'
import { AuthenticationRequiredError, InstructorApiError, type createInstructorApi } from '@/api/instructor-v1'
import type {
  WizardConversationMessage, WizardDraft, WizardProtocol,
  WizardRevision, WizardPreview, WizardSurvey, WizardTemplate, WizardVersion,
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
import { WizardStepHeading } from './prompt-designer/WizardStepHeading'
import { PreviewStep } from './prompt-designer/PreviewStep'
import { WizardChoiceCard } from './prompt-designer/WizardChoiceCard'
import type { WizardStep } from './prompt-designer/WorkflowStepper'

type Api = ReturnType<typeof createInstructorApi>
type Audience = 'individual' | 'team'
type Style = 'guided' | 'open'
type InstructionDelivery = {
  courseId: string
  draftId: string
  messageId: string
  content: string
  key: string
  expectedVersion?: number
  retryMessageId?: string
}

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
  const [deleteDraftOpen, setDeleteDraftOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [step, setStep] = useState<WizardStep>(0)
  const [source, setSource] = useState<'leai' | 'my' | 'community' | 'scratch'>('leai')
  const [howOpen, setHowOpen] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [audience, setAudience] = useState<Audience>('individual')
  const [audienceChoice, setAudienceChoice] = useState<Audience | null>(null)
  const [style, setStyle] = useState<Style>('guided')
  const [styleChosen, setStyleChosen] = useState(false)
  const [newTitle, setNewTitle] = useState('New feedback')
  const [draft, setDraft] = useState<WizardDraft | null>(null)
  const [body, setBody] = useState<WizardProtocol | null>(null)
  const [versions, setVersions] = useState<WizardVersion[]>([])
  const [conversation, setConversation] = useState<WizardConversationMessage[]>([])
  const [localInstructions, setLocalInstructions] = useState<{
    message: WizardConversationMessage; previousIds: string[]; failed: boolean; changed?: boolean; connection?: boolean
  }[]>([])
  const [replyFailure, setReplyFailure] = useState('')
  const [replyRecovery, setReplyRecovery] = useState<{
    kind: 'reply' | 'connection' | 'not-sent' | 'changed'; delivery: InstructionDelivery
  } | null>(null)
  const [composer, setComposer] = useState('')
  const [aiJobId, setAiJobId] = useState('')
  const [aiSending, setAiSending] = useState(false)
  const [revision, setRevision] = useState<WizardRevision | null>(null)
  const [previewSurvey, setPreviewSurvey] = useState<WizardPreview | null>(null)
  const [previewOpened, setPreviewOpened] = useState(false)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewSkipOpen, setPreviewSkipOpen] = useState(false)
  const previewSkipTriggerRef = useRef<HTMLButtonElement>(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateSaveStatus, setTemplateSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [templateSaveError, setTemplateSaveError] = useState('')
  const [publishLabel, setPublishLabel] = useState('')
  const [publishedSurvey, setPublishedSurvey] = useState<WizardSurvey | null>(null)
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [certificateEnabled, setCertificateEnabled] = useState(true)
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
  const aiSendLockedRef = useRef(false)
  const aiInstructionIdRef = useRef('')
  const unresolvedInstructionRef = useRef('')
  const deliveriesRef = useRef(new Map<string, InstructionDelivery>())
  const courseIdRef = useRef(courseId)
  courseIdRef.current = courseId
  const builderEpochRef = useRef(0)
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
  const selectedTemplateId = source === 'scratch' ? '' : templateId || visibleTemplates[0]?.id || ''

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
    builderEpochRef.current += 1
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
    aiSendLockedRef.current = false
    aiInstructionIdRef.current = ''
    unresolvedInstructionRef.current = ''
    setAiSending(false)
    setLocalInstructions([])
    deliveriesRef.current.clear()
    setReplyFailure('')
    setReplyRecovery(null)
    setError('')
  }

  const reconcileConversation = useCallback((messages: WizardConversationMessage[]) => {
    setConversation(messages)
    setLocalInstructions((current) => current.filter((local) => !messages.some((message) =>
      message.role === 'user' && message.content === local.message.content && !local.previousIds.includes(message.id),
    )))
  }, [])

  const loadDraft = useCallback(async (id: string, onConversation?: (messages: WizardConversationMessage[]) => void) => {
    const epoch = builderEpochRef.current
    const [loaded, history, chat] = await Promise.all([
      api.wizardDraft(courseId, id), api.wizardVersions(courseId, id), api.wizardConversation(courseId, id),
    ])
    if (epoch !== builderEpochRef.current || courseId !== courseIdRef.current) return loaded
    setDraft(loaded)
    setAudience(loaded.audience)
    setAudienceChoice(loaded.audience)
    setStyle(loaded.collection_style)
    setStyleChosen(true)
    setPublishLabel(loaded.title)
    draftIdRef.current = loaded.id
    versionRef.current = loaded.draft_version
    bodyRef.current = loaded.body
    dirtyRef.current = false
    setBody(loaded.body)
    setVersions(history.versions)
    reconcileConversation(chat.messages)
    onConversation?.(chat.messages)
    setSaveStatus(elapsedSave(loaded.updated_at))
    return loaded
  }, [api, courseId, reconcileConversation])

  const saveNow = useCallback(async function flushSave(chatSend = false): Promise<void> {
    if (savingRef.current) {
      await savingRef.current
      if (dirtyRef.current) return flushSave(chatSend)
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
    const epoch = builderEpochRef.current
    const ownsSave = () => epoch === builderEpochRef.current && courseId === courseIdRef.current && id === draftIdRef.current
    dirtyRef.current = false
    setSaveStatus('Saving…')
    const promise = api.saveWizardDraft(courseId, id, expected, payload, crypto.randomUUID()).then((saved) => {
      if (!ownsSave()) return
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
      void api.wizardVersions(courseId, id).then((result) => { if (ownsSave()) setVersions(result.versions) })
    }).catch((cause: unknown) => {
      if (!ownsSave()) throw cause
      dirtyRef.current = true
      setSaveStatus('Not saved')
      if (!chatSend || cause instanceof AuthenticationRequiredError) handleError(cause)
      throw cause
    }).finally(() => { savingRef.current = null })
    savingRef.current = promise
    await promise
    if (!ownsSave()) return
    if (dirtyRef.current && bodyRef.current !== payload) await flushSave(chatSend)
  }, [api, courseId, handleError, queryClient])

  useEffect(() => {
    if (!builderOpen || !draft || !body || !dirtyRef.current) return
    const timer = window.setTimeout(() => { void saveNow().catch(() => {}) }, 1200)
    return () => window.clearTimeout(timer)
  }, [body, builderOpen, draft, saveNow])

  useEffect(() => {
    if (!aiJobId || !draft || !builderOpen) return
    let active = true
    let polling = false
    const epoch = builderEpochRef.current
    const instructionId = aiInstructionIdRef.current
    const ownsJob = () => epoch === builderEpochRef.current && courseId === courseIdRef.current
      && draft.id === draftIdRef.current && instructionId === aiInstructionIdRef.current
    const timer = window.setInterval(() => {
      if (polling) return
      polling = true
      let replyFailed = false
      void api.job(courseId, aiJobId).then(async (job) => {
        if (!active || !ownsJob() || job.status === 'pending' || job.status === 'running') return
        let reconciled = false
        try {
          if (job.status === 'completed') {
            if (!dirtyRef.current) await loadDraft(draft.id)
            else {
              const chat = await api.wizardConversation(courseId, draft.id)
              if (!ownsJob()) return
              reconcileConversation(chat.messages)
            }
            if (!ownsJob()) return
            setReplyFailure('')
            setReplyRecovery(null)
            unresolvedInstructionRef.current = ''
            deliveriesRef.current.delete(instructionId)
            setNotice('LEAI updated the saved draft.')
          } else {
            replyFailed = true
            setReplyFailure('Couldn’t generate a reply')
            const chat = await api.wizardConversation(courseId, draft.id)
            if (!ownsJob()) return
            reconcileConversation(chat.messages)
            const delivery = deliveriesRef.current.get(instructionId)
            const persisted = chat.messages.filter((message) => message.role === 'user').at(-1)
            if (delivery && persisted?.content === delivery.content) {
              setReplyRecovery({ kind: 'reply', delivery: { ...delivery, retryMessageId: persisted.id } })
            }
          }
          reconciled = true
          window.clearInterval(timer)
        } finally {
          if (ownsJob() && reconciled) {
            aiSendLockedRef.current = false
            setAiSending(false)
            setAiJobId('')
          }
        }
      }).catch((cause: unknown) => {
        if (!active || !ownsJob()) return
        if (cause instanceof AuthenticationRequiredError) handleError(cause)
        else setReplyFailure(replyFailed ? 'Couldn’t generate a reply' : 'Connection lost')
      }).finally(() => { polling = false })
    }, 1200)
    return () => { active = false; window.clearInterval(timer) }
  }, [aiJobId, api, builderOpen, courseId, draft, handleError, loadDraft, reconcileConversation])

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
      const selected = templates.find((item) => item.id === selectedTemplateId)
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

  async function sendAi(consumeTranscript: () => void) {
    const instruction = composer.trim()
    if (!draft || !instruction || aiSendLockedRef.current || unresolvedInstructionRef.current) return
    const message: WizardConversationMessage = {
      id: `local-${crypto.randomUUID()}`, role: 'user', content: instruction, created_at: new Date().toISOString(),
    }
    const delivery: InstructionDelivery = {
      courseId, draftId: draft.id, messageId: message.id, content: instruction, key: crypto.randomUUID(),
    }
    deliveriesRef.current.set(message.id, delivery)
    unresolvedInstructionRef.current = message.id
    setLocalInstructions((current) => [...current, { message, previousIds: conversation.map((row) => row.id), failed: false }])
    consumeTranscript()
    setComposer('')
    setError('')
    await deliverInstruction(delivery)
  }

  async function deliverInstruction(delivery: InstructionDelivery) {
    const ownsDraft = () => draftIdRef.current === delivery.draftId && courseIdRef.current === delivery.courseId
      && deliveriesRef.current.get(delivery.messageId) === delivery
    if (!ownsDraft() || aiSendLockedRef.current) return
    aiSendLockedRef.current = true
    aiInstructionIdRef.current = delivery.messageId
    setAiSending(true)
    setReplyFailure('')
    const isCurrentInstruction = () => ownsDraft() && aiSendLockedRef.current && aiInstructionIdRef.current === delivery.messageId
    try {
      // Only the first attempt may save. A lost ACK must replay the exact request.
      if (delivery.expectedVersion === undefined) {
        await saveNow(true)
        if (!isCurrentInstruction()) return
        delivery.expectedVersion = versionRef.current
      }
      const result = delivery.retryMessageId
        ? await api.startWizardAi(delivery.courseId, delivery.draftId, delivery.content, delivery.expectedVersion, delivery.key, delivery.retryMessageId)
        : await api.startWizardAi(delivery.courseId, delivery.draftId, delivery.content, delivery.expectedVersion, delivery.key)
      if (!isCurrentInstruction()) return
      setAiJobId(result.job_id)
    } catch (cause) {
      if (!isCurrentInstruction()) return
      aiSendLockedRef.current = false
      setAiSending(false)
      setLocalInstructions((current) => current.map((local) => local.message.id === delivery.messageId
        ? { ...local, failed: true, connection: delivery.expectedVersion !== undefined,
          changed: cause instanceof InstructorApiError && cause.status === 409 } : local))
      setError('')
      if (delivery.retryMessageId) setReplyRecovery({ delivery,
        kind: cause instanceof InstructorApiError && cause.status === 409 ? 'changed'
          : delivery.expectedVersion === undefined ? 'not-sent' : 'connection' })
      if (cause instanceof AuthenticationRequiredError) handleError(cause)
      return
    }
    // An ACK owns a running job even if this read fails; keep sending locked.
    try {
      const chat = await api.wizardConversation(delivery.courseId, delivery.draftId)
      if (isCurrentInstruction()) reconcileConversation(chat.messages)
    } catch (cause) {
      if (isCurrentInstruction() && cause instanceof AuthenticationRequiredError) handleError(cause)
    }
  }

  async function retryInstruction(messageId: string) {
    const delivery = deliveriesRef.current.get(messageId)
    if (!delivery || aiSendLockedRef.current || delivery.courseId !== courseIdRef.current || delivery.draftId !== draftIdRef.current) return
    if (unresolvedInstructionRef.current && unresolvedInstructionRef.current !== messageId) return
    if (localInstructions.find((local) => local.message.id === messageId)?.changed) {
      // Refresh is explicit; never silently move an uncertain delivery onto a newer version.
      const epoch = builderEpochRef.current
      const ownsRefresh = () => epoch === builderEpochRef.current && delivery.courseId === courseIdRef.current
        && delivery.draftId === draftIdRef.current && deliveriesRef.current.get(messageId) === delivery
      aiSendLockedRef.current = true
      setAiSending(true)
      try {
        await loadDraft(delivery.draftId, (messages) => {
          if (!ownsRefresh()) return
          const local = localInstructions.find((row) => row.message.id === messageId)
          const persisted = messages.some((row) => row.role === 'user' && row.content === delivery.content && !local?.previousIds.includes(row.id))
          if (persisted) return
          // The 409 rejected this instruction and the fresh transcript confirms non-delivery.
          delivery.key = crypto.randomUUID()
          delivery.expectedVersion = undefined
          unresolvedInstructionRef.current = ''
          setLocalInstructions((current) => current.map((row) => row.message.id === messageId
            ? { ...row, changed: false, connection: false, previousIds: messages.map((message) => message.id) } : row))
        })
      } catch (cause) { if (cause instanceof AuthenticationRequiredError) handleError(cause) }
      finally {
        if (ownsRefresh()) { aiSendLockedRef.current = false; setAiSending(false) }
      }
      return
    }
    unresolvedInstructionRef.current = messageId
    await deliverInstruction(delivery)
  }

  async function retryReply() {
    if (!replyRecovery || aiSendLockedRef.current) return
    const original = replyRecovery.delivery
    if (original.courseId !== courseIdRef.current || original.draftId !== draftIdRef.current) return
    if (replyRecovery.kind === 'changed') {
      try { await loadDraft(original.draftId) }
      catch (cause) { if (cause instanceof AuthenticationRequiredError) handleError(cause) }
      return
    }
    // A deliberate new AI attempt reuses the persisted user row. A lost ACK replays itself.
    const delivery = replyRecovery.kind === 'reply'
      ? { ...original, messageId: `reply-${crypto.randomUUID()}`, key: crypto.randomUUID(), expectedVersion: undefined }
      : original
    deliveriesRef.current.set(delivery.messageId, delivery)
    unresolvedInstructionRef.current = delivery.messageId
    await deliverInstruction(delivery)
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

  async function deleteDraft() {
    if (!latestDraft) return
    setBusy(true)
    try {
      await api.deleteWizardDraft(courseId, latestDraft.id, latestDraft.draft_version)
      await draftsQuery.refetch()
      setDeleteDraftOpen(false)
      if (draft?.id === latestDraft.id) { setDraft(null); setBody(null); setRevision(null); setPreviewSurvey(null) }
      setNotice('Draft deleted. Its preview link and test responses have been removed.')
    } catch (cause) { handleError(cause) }
    finally { setBusy(false) }
  }

  async function toPreview() {
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      await saveNow()
      const frozen = await api.freezeWizardDraft(courseId, draft.id, versionRef.current)
      if (!revision || publishLabel === revision.body.title) setPublishLabel(frozen.revision.body.title)
      const preview = await api.wizardPreview(courseId, frozen.revision.id, {
        completion_certificate_enabled: certificateEnabled,
        completed_response_download_enabled: downloadEnabled,
      })
      setPreviewSurvey(preview)
      setRevision(preview.revision)
      setPreviewOpened(false)
      setStep(3)
    } catch (cause) { handleError(cause) }
    finally { setBusy(false) }
  }

  function launchPreview() {
    if (!previewSurvey) return
    const href = toAppHref(environment, previewSurvey.direct_url)
    const opened = window.open(href, '_blank')
    if (!opened) { setError('Your browser blocked the preview tab. Allow pop-ups for this site and try again.'); return }
    setPreviewOpened(true)
  }

  async function savePreviewOutputs(certificate: boolean, download: boolean) {
    if (!revision || previewBusy) return
    setPreviewBusy(true)
    setError('')
    try {
      const saved = await api.wizardPreview(courseId, revision.id, {
        completion_certificate_enabled: certificate,
        completed_response_download_enabled: download,
      })
      setPreviewSurvey(saved)
      setCertificateEnabled(saved.completion_certificate_enabled)
      setDownloadEnabled(saved.completed_response_download_enabled)
    } catch (cause) { handleError(cause) }
    finally { setPreviewBusy(false) }
  }

  async function decidePreview(decision: 'completed' | 'skipped') {
    if (!revision) return
    setPreviewBusy(true)
    try {
      setRevision(await api.decideWizardPreview(courseId, revision.id, decision, crypto.randomUUID()))
      if (decision === 'skipped') setStep(4)
    }
    catch (cause) { handleError(cause) }
    finally { setPreviewBusy(false) }
  }

  function requestPreviewSkip() {
    if (!revision || previewBusy) return
    let acknowledged = false
    try { acknowledged = window.localStorage.getItem(qualifyBrowserKey(environment.name, 'wizard-preview-skip-acknowledged')) === '1' } catch { /* Confirmation remains available when storage is blocked. */ }
    if (acknowledged) void decidePreview('skipped')
    else setPreviewSkipOpen(true)
  }

  function confirmPreviewSkip() {
    try { window.localStorage.setItem(qualifyBrowserKey(environment.name, 'wizard-preview-skip-acknowledged'), '1') } catch { /* The next attempt can show the warning again. */ }
    setPreviewSkipOpen(false)
    void decidePreview('skipped')
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
      const ready = await api.setupWizardTeams(courseId, teamSurvey.id, labels, crypto.randomUUID())
      if (previewSurvey?.survey_id === ready.id) setPreviewSurvey({ ...previewSurvey, survey: ready })
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
    if (step === 0) return null
    const back = <Button disabled={busy} onClick={() => {
      if (step === 1 && audience === 'individual' && styleChosen) setStyleChosen(false)
      else {
        if (step === 1) setAudienceChoice(null)
        setStep((step - 1) as WizardStep)
      }
    }} type="button" variant="outline">
      <ArrowLeft className="size-4" />Back
    </Button>
    const next = step === 1
        ? styleChosen && <Button disabled={busy} onClick={() => {
          if (draft) setStep(2)
          else void createDraft()
        }} type="button">
          {busy ? 'Creating…' : 'Continue'}<ArrowRight className="size-4" />
        </Button>
        : step === 2
          ? <Button disabled={busy || !body} onClick={() => { void toPreview() }} type="button">
            {busy ? 'Preparing…' : 'Generate preview'}<ArrowRight className="size-4" />
          </Button>
          : step === 3
            ? <div className="flex items-center gap-3">
              {!revision?.preview_decision && <Button disabled={previewBusy} onClick={requestPreviewSkip} ref={previewSkipTriggerRef} type="button" variant="ghost">Skip</Button>}
              <Button disabled={!revision?.preview_decision || previewBusy} onClick={() => setStep(4)} type="button">Continue to publish</Button>
            </div>
            : <Button disabled={busy || !canPublish || !revision?.preview_decision} onClick={() => { void publish() }} type="button">
              {busy ? 'Publishing…' : 'Publish & get link'}
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
            setTemplateId(''); setSource('leai'); setAudience('individual'); setAudienceChoice(null); setStyle('guided'); setStyleChosen(false)
            setRevision(null); setPublishedSurvey(null); setPreviewOpened(false); setNewTitle('New feedback'); setCertificateEnabled(true); setDownloadEnabled(false); setHowOpen(false); setBuilderOpen(true)
          }} className="legacy-prompt-create" type="button"><Plus className="size-4" />Create new feedback</Button>
          {latestDraft && <div className="rounded-lg border border-border p-4">
            <p className="font-medium">{latestDraft.title}</p>
            <p className="text-sm text-muted-foreground">{latestDraft.audience} · {latestDraft.collection_style} · {elapsedSave(latestDraft.updated_at)}</p>
            <Button className="mt-3" disabled={busy} onClick={() => { void continueDraft() }} type="button" variant="outline">
              <FilePenLine className="size-4" />Continue previous session
            </Button>
            <Button className="mt-3 ml-2" disabled={busy} onClick={() => setDeleteDraftOpen(true)} type="button" variant="ghost">Delete draft</Button>
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
      {step === 0 && <div className="mx-auto max-w-[900px] space-y-6">
        <WizardStepHeading eyebrow="Step 1" title="Who are you collecting feedback from?">
          <p>Choose the purpose. Neither option is preferred over the other.</p>
        </WizardStepHeading>
        <div aria-label="Feedback audience" className="grid gap-[18px] min-[901px]:grid-cols-2" role="radiogroup">
          {(['individual', 'team'] as const).map((value) => <WizardChoiceCard description={value === 'individual' ? 'Collect each student’s own learning experience, needs, and suggestions.' : 'Collect private feedback about collaboration inside the team each student selects.'}
            details={value === 'individual' ? ['Names are not collected with answers', 'Class-level patterns for the instructor', 'Choose guided questions or an open conversation next'] : ["Designed for feedback within the student's own team", 'No cross-group target, comparison, ranking, or scoring feature', 'One name-hidden session is bound to one self-selected team']}
            disabled={!!draft} groupName="wizard-audience" key={value} onSelect={() => {
              setAudience(value); setAudienceChoice(value); setTemplateId(''); setStyle('guided'); setStyleChosen(value === 'team'); setStep(1)
            }} selected={audienceChoice === value} title={value === 'individual' ? 'Individual feedback' : 'Team feedback'} value={value === 'individual' ? '1' : 'T'} />)}
        </div>
        <div className="text-center"><Button onClick={() => setHowOpen(!howOpen)} type="button" variant="link">How LEAI works</Button></div>
        {howOpen && <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="text-lg font-semibold">How LEAI works</h4>
          <ol className="mt-4 grid gap-3 text-base sm:grid-cols-4">{['Choose a purpose', 'Select a starting point', 'Design together', 'Preview and publish'].map((label, index) => <li className="rounded-lg bg-muted p-3" key={label}><span className="mr-2 font-bold text-primary">{index + 1}.</span>{label}</li>)}</ol>
        </div>}
      </div>}
      {step === 1 && <div className="mx-auto max-w-[900px] space-y-6">
        {audience === 'individual' && !styleChosen ? <>
          <WizardStepHeading eyebrow="Step 2" title="How should the conversation work?">
            <p>Both paths open the same editable workspace.</p>
          </WizardStepHeading>
          <div aria-label="Feedback format" className="grid gap-[18px] min-[901px]:grid-cols-2" role="radiogroup">
            {(['guided', 'open'] as const).map((value) => <WizardChoiceCard description={value === 'guided' ? 'Every student encounters a planned set of questions and optional follow-ups.' : 'Set one opening question and a listening goal, then follow what the student raises.'}
              details={value === 'guided' ? ['Easier to compare across students or weeks', 'AI may ask one focused follow-up', 'You can build manually or collaborate with AI'] : ['Useful for discovering unexpected concerns', 'Less consistent across students and weeks', 'Harder to compare and summarize reliably']}
              disabled={!!draft} groupName="wizard-style" key={value} onSelect={() => { setStyle(value); setStyleChosen(true); setTemplateId(''); setSource(value === 'open' ? 'scratch' : 'leai') }} selected={false}
              title={value === 'guided' ? 'Guided feedback' : 'Open conversation'} value={value === 'guided' ? '✓' : '…'} />)}
          </div>
        </> : <>
        <WizardStepHeading eyebrow="Starting point" title={style === 'open' ? 'Start your open conversation' : 'Choose a starting point'}>
          <p>Everything remains editable after you choose.</p>
        </WizardStepHeading>
        <label className="block space-y-2"><span className="font-medium">Working title</span>
          <Input maxLength={200} onChange={(event) => setNewTitle(event.target.value)} value={newTitle} /></label>
        {style === 'guided' ? <>
        <Tabs onValueChange={(value) => { setSource(value as typeof source); setTemplateId('') }} value={source}>
          <TabsList className="h-auto w-full flex-wrap justify-start border-b border-border bg-transparent" variant="line">
            <TabsTrigger className="flex-none px-[15px] py-[11px] text-[13px] font-bold" value="leai">LEAI templates</TabsTrigger>
            <TabsTrigger className="flex-none px-[15px] py-[11px] text-[13px] font-bold" value="my">My templates</TabsTrigger>
            <TabsTrigger className="flex-none px-[15px] py-[11px] text-[13px] font-bold" value="community">Community</TabsTrigger>
            <TabsTrigger className="flex-none px-[15px] py-[11px] text-[13px] font-bold" value="scratch">Start from scratch</TabsTrigger>
          </TabsList>
          {(['leai', 'my', 'community'] as const).map((kind) => <TabsContent className="min-h-56 pt-4" key={kind} value={kind}>
            {templatesQuery.isLoading ? <p role="status">Loading templates…</p>
              : visibleTemplates.length ? <div className="grid auto-cols-[minmax(270px,40%)] grid-flow-col gap-3 overflow-x-auto pb-3">{visibleTemplates.map((template: WizardTemplate) =>
                <button aria-pressed={selectedTemplateId === template.id} className={`min-w-0 rounded-[14px] border bg-card p-[22px] text-left hover:border-primary/60 ${selectedTemplateId === template.id ? 'border-primary ring-2 ring-primary/10' : 'border-border'}`}
                  key={template.id} onClick={() => {
                    setTemplateId(template.id); setNewTitle(template.name)
                  }} type="button">
                  <span className="mb-2 block text-[10px] font-extrabold tracking-[0.09em] text-muted-foreground uppercase">{kind === 'leai' ? 'LEAI templates' : kind === 'my' ? 'My templates' : 'Community'}</span>
                  <strong className="block text-[19px]">{template.name}</strong>
                  <span className="mt-1 block text-sm leading-[1.48] text-muted-foreground">{template.description || 'Reusable guided feedback design'}</span>
                  <span className="mt-3 block text-xs font-bold text-primary">Fixed copy · editable after selection</span>
                </button>)}</div> : <p className="text-muted-foreground">No templates in this collection yet. Start from scratch or choose LEAI.</p>}
          </TabsContent>)}
          <TabsContent className="min-h-56 pt-4" value="scratch">
            <p className="rounded-xl border border-border bg-card p-5">Start with one editable question and add sections as you design.</p>
          </TabsContent>
        </Tabs>
        </> : <p className="rounded-xl border border-primary bg-card p-5">Start from scratch. Add the opening, listening goal, and closing in the workspace.</p>}
        {audience === 'team' && <p className="text-sm text-muted-foreground">Team feedback currently uses Guided feedback.</p>}
        {draft && <p className="text-sm text-muted-foreground">The audience and format are fixed for this draft. Create a new draft to change them.</p>}
        </>}
      </div>}
      {step === 2 && body && <div className="grid min-w-0 gap-0 overflow-hidden rounded-xl border border-border bg-card xl:h-[min(38rem,calc(100dvh-18rem))] xl:min-h-[30rem] xl:grid-cols-[minmax(17rem,34%)_minmax(0,66%)]">
        <AuthoringConversation busy={aiSending} disabled={!draft} messages={[...conversation, ...localInstructions.map((local) => local.message)]}
          failedMessageIds={localInstructions.filter((local) => local.failed).map((local) => local.message.id)} onSend={(consumeTranscript) => { void sendAi(consumeTranscript) }}
          changedMessageIds={localInstructions.filter((local) => local.changed).map((local) => local.message.id)} onRetry={(id) => { void retryInstruction(id) }} replyFailure={replyFailure}
          connectionMessageIds={localInstructions.filter((local) => local.connection).map((local) => local.message.id)}
          sendBlocked={!!unresolvedInstructionRef.current} replyRecovery={replyRecovery ? { kind: replyRecovery.kind, onRetry: () => { void retryReply() } } : undefined}
          onValueChange={setComposer} value={composer} />
        <div className="min-w-0 bg-card p-4 xl:h-full xl:overflow-y-auto xl:p-5"><ArtifactEditor audience={draft?.audience ?? audience} body={body} collectionStyle={draft?.collection_style ?? 'guided'} disabled={false} onChange={editBody} onRestore={(version) => { void restoreVersion(version) }}
          saveStatus={saveStatus} versions={versions} /></div>
      </div>}
      {step === 3 && revision && <PreviewStep teamSetupRequired={previewSurvey?.survey.team_setup_required ?? false}
        onSetupTeams={() => { if (previewSurvey) setTeamSurvey(previewSurvey.survey) }} busy={previewBusy}
        onLaunch={() => { void launchPreview() }}
        previewOpened={previewOpened} revision={revision} certificateEnabled={certificateEnabled} downloadEnabled={downloadEnabled}
        onCertificateChange={(value) => void savePreviewOutputs(value, downloadEnabled)} onDownloadChange={(value) => void savePreviewOutputs(certificateEnabled, value)} />}
      {step === 4 && publishedSurvey && <div aria-live="polite" className="mx-auto max-w-3xl rounded-xl border border-success/30 bg-success/5 p-8 text-center">
        <h3 className="text-2xl font-semibold">Feedback published</h3>
        <p className="mt-3 text-base text-muted-foreground"><span className="font-medium text-foreground">{publishedSurvey.label}</span> is published. Return to the survey list to review the new card and copy its link.</p>
      </div>}
      {step === 4 && revision && !publishedSurvey && <div className="mx-auto max-w-[1180px] space-y-5">
        <WizardStepHeading eyebrow="Final step" title="Publish this feedback">
          <p>It becomes available immediately unless you choose an opening time. Dates remain blank unless you set them.</p>
        </WizardStepHeading>
        <div className="grid gap-[18px] min-[1101px]:grid-cols-[minmax(0,1fr)_320px]"><div className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-[18px] md:p-[22px]">
        <label className="block space-y-2"><span className="text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase">Feedback label</span>
          <Input maxLength={200} onChange={(event) => setPublishLabel(event.target.value)} value={publishLabel} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2"><span className="text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase">Opens (optional)</span>
            <Input onChange={(event) => setOpensAt(event.target.value)} type="datetime-local" value={opensAt} /></label>
          <label className="block space-y-2"><span className="text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase">Closes (optional)</span>
            <Input onChange={(event) => setClosesAt(event.target.value)} type="datetime-local" value={closesAt} /></label>
        </div>
        <p className="text-sm text-muted-foreground">Blank dates mean available now with no automatic close.</p>
        </div><aside className="min-w-0 rounded-xl border border-border bg-card p-[18px] md:p-[22px]"><p className="text-sm font-bold tracking-widest text-primary uppercase">Publication summary</p><dl className="mt-3 divide-y divide-border text-base"><div className="py-3"><dt className="text-sm font-bold text-muted-foreground uppercase">Audience</dt><dd>{audience === 'team' ? 'Team members' : 'Individual students'}</dd></div><div className="py-3"><dt className="text-sm font-bold text-muted-foreground uppercase">Format</dt><dd>{style === 'open' ? 'Open conversation' : `Guided · ${revision.body.sections.reduce((count, section) => count + section.items.length, 0)} questions`}</dd></div><div className="py-3"><dt className="text-sm font-bold text-muted-foreground uppercase">Preview</dt><dd>{revision.preview_decision === 'completed' ? 'Completed' : 'Skipped'}</dd></div><div className="py-3"><dt className="text-sm font-bold text-muted-foreground uppercase">Student outputs</dt><dd>Certificate {certificateEnabled ? 'on' : 'off'} · response form {downloadEnabled ? 'on' : 'off'}</dd></div></dl></aside></div>
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

    <AlertDialog open={deleteDraftOpen} onOpenChange={setDeleteDraftOpen}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this draft?</AlertDialogTitle>
        <AlertDialogDescription>Its preview link, test sessions and answers will be removed.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
        <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void deleteDraft() }}>Delete draft</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <AlertDialog onOpenChange={setPreviewSkipOpen} open={previewSkipOpen}>
      <AlertDialogContent className="legacy-builder-theme" onCloseAutoFocus={(event) => {
        event.preventDefault()
        previewSkipTriggerRef.current?.focus()
      }}>
        <AlertDialogHeader><AlertDialogTitle>Skip the student preview?</AlertDialogTitle>
          <AlertDialogDescription>You can still go back before publishing.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep previewing</AlertDialogCancel>
          <AlertDialogAction onClick={confirmPreviewSkip}>Skip preview</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
