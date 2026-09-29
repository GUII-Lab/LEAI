import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CanonicalCourse } from '@/api/contracts/instructor'
import { AuthenticationRequiredError, InstructorApiError } from '@/api/instructor-v1'
import type {
  FeedbackChatDetail,
  FeedbackChatJob,
  FeedbackChatOccurrence,
  FeedbackChatSummary,
} from '@/api/contracts/feedback-chat'
import { loginHref } from '@/auth/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ChevronDown, MessagesSquare, SlidersHorizontal } from 'lucide-react'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatTranscript } from '@/components/chat/ChatTranscript'
import { useChatVoiceInput } from '@/components/chat/useChatVoiceInput'
import { ChatCitation, type ChatCitationSource } from './feedback-chat/ChatCitation'
import { ChatSessionList } from './feedback-chat/ChatSessionList'
import { qualifyBrowserKey, toAppHref, type PublicEnvironment } from '@/config/environment'

type Id = string
const emptyChats: FeedbackChatSummary[] = []
export type FeedbackChatApi = {
  courses(signal?: AbortSignal): Promise<{ courses: CanonicalCourse[] }>
  occurrences(courseId: Id, signal?: AbortSignal): Promise<{ occurrences: FeedbackChatOccurrence[] }>
  chats(courseId: Id, signal?: AbortSignal): Promise<{ chats: FeedbackChatSummary[] }>
  createChat(courseId: Id, input: { title?: string }): Promise<FeedbackChatDetail>
  chat(courseId: Id, chatId: Id, signal?: AbortSignal): Promise<FeedbackChatDetail>
  renameChat(courseId: Id, chatId: Id, input: { title?: string; prompt_override?: string | null }): Promise<FeedbackChatDetail>
  archiveChat(courseId: Id, chatId: Id): Promise<void>
  addChatScope(courseId: Id, chatId: Id, input: { occurrence_ids: Id[] }): Promise<FeedbackChatDetail>
  createTurn(courseId: Id, chatId: Id, input: { content: string; retry_message_id?: string }, idempotencyKey: string): Promise<{ job_id: Id }>
  job(courseId: Id, jobId: Id, signal?: AbortSignal): Promise<FeedbackChatJob>
  logout(): Promise<void>
}

type AssistantCitation = FeedbackChatDetail['messages'][number]['citations'][number]

function asCitationSource(citation: AssistantCitation): ChatCitationSource {
  return { citationId: citation.id, citationNumber: citation.citation_number, responseExcerpt: citation.evidence_quote,
    weekLabel: citation.week_label ?? undefined, surveyLabel: citation.survey_label ?? undefined,
    questionLabel: citation.question_label ?? undefined }
}

function inlineMarkdown(text: string, citations: readonly AssistantCitation[], onOpenSource: (citation: ChatCitationSource) => void) {
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\d+\])/g
  return text.split(tokenPattern).filter(Boolean).map((part, index) => {
    const number = /^\[(\d+)\]$/.exec(part)?.[1]
    const citation = number ? citations.find((item) => item.citation_number === Number(number)) : undefined
    if (citation) return <ChatCitation citation={asCitationSource(citation)} key={index} onOpenSource={onOpenSource} />
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`')) return <code className="rounded bg-muted px-1" key={index}>{part.slice(1, -1)}</code>
    return <span key={index}>{part}</span>
  })
}

function renderAssistantMarkdown(markdown: string, citations: readonly AssistantCitation[], onOpenSource: (citation: ChatCitationSource) => void) {
  const blocks: Array<{ type: 'paragraph' | 'heading' | 'list'; text: string; level?: number }> = []
  let paragraph: string[] = []
  let list: string[] = []
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
    paragraph = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', text: list.join('\n') })
    list = []
  }
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    const item = /^\s*[-*]\s+(.+)$/.exec(line)
    if (!line.trim()) { flushParagraph(); flushList(); continue }
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: 'heading', text: heading[2], level: heading[1].length }); continue }
    if (item) { flushParagraph(); list.push(item[1]); continue }
    flushList(); paragraph.push(line)
  }
  flushParagraph(); flushList()
  return blocks.map((block, index) => {
    if (block.type === 'heading') {
      const className = 'font-semibold'
      if (block.level === 1) return <h3 className={className} key={index}>{inlineMarkdown(block.text, citations, onOpenSource)}</h3>
      if (block.level === 2) return <h4 className={className} key={index}>{inlineMarkdown(block.text, citations, onOpenSource)}</h4>
      return <h5 className={className} key={index}>{inlineMarkdown(block.text, citations, onOpenSource)}</h5>
    }
    if (block.type === 'list') return <ul className="list-disc space-y-1 pl-5" key={index}>{block.text.split('\n').map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item, citations, onOpenSource)}</li>)}</ul>
    return <p className="whitespace-pre-wrap" key={index}>{inlineMarkdown(block.text, citations, onOpenSource)}</p>
  })
}

function exportMarkdown(chat: FeedbackChatDetail) {
  const lines = [`# ${chat.title}`, '']
  for (const message of chat.messages) {
    lines.push(`## ${message.role === 'assistant' ? 'Feedback Chat' : 'Instructor'}`, '', message.content, '')
    if (message.citations.length) {
      lines.push('Sources:')
      for (const citation of message.citations) lines.push(`- [${citation.citation_number}] ${citation.survey_label ?? 'Course feedback'}: “${citation.evidence_quote}”`)
      lines.push('')
    }
  }
  return lines.join('\n')
}

export function FeedbackChatPage({ api, environment, verified }: {
  api: FeedbackChatApi
  environment: PublicEnvironment
  verified: boolean
}) {
  const queryClient = useQueryClient()
  const tokenKey = qualifyBrowserKey(environment.name, 'instructor-token')
  const courseKey = qualifyBrowserKey(environment.name, 'selected-course')
  const [signedOut, setSignedOut] = useState(false)
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const selectedCourseId = sessionStorage.getItem(courseKey) ?? ''
  const [selectedChatId, setSelectedChatId] = useState(() => params.get('chat_id') ?? '')
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState(() => params.get('occurrence_id') ?? '')
  const [composerText, setComposerText] = useState('')
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [promptDraft, setPromptDraft] = useState<string | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [scopeSelection, setScopeSelection] = useState<string[]>([])
  const [renameOpen, setRenameOpen] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [archiveTarget, setArchiveTarget] = useState('')
  const [activeJobId, setActiveJobId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const deepLinkApplied = useRef(false)
  const promptDraftChatId = useRef('')
  const turnAttempt = useRef<{ courseId: string; chatId: string; text: string; retryMessageId?: string; key: string } | null>(null)
  const clearSession = useCallback((message = '') => {
    void queryClient.cancelQueries()
    queryClient.clear()
    sessionStorage.removeItem(tokenKey)
    sessionStorage.removeItem(courseKey)
    setSignedOut(true)
    setSelectedChatId('')
    setActiveJobId('')
    setError(message)
    window.location.replace(loginHref(environment, window.location.pathname))
  }, [courseKey, environment, queryClient, tokenKey])
  const protectedRequest = useCallback(async <T,>(request: () => Promise<T>) => {
    try { return await request() }
    catch (cause) {
      if (cause instanceof AuthenticationRequiredError) clearSession('Your session ended. Sign in again.')
      throw cause
    }
  }, [clearSession])
  const courseQuery = useQuery({
    queryKey: ['instructor-courses', environment.name],
    queryFn: async ({ signal }) => (await protectedRequest(() => api.courses(signal))).courses,
    enabled: verified && !signedOut, retry: false,
  })
  const courses = courseQuery.data ?? []
  const activeCourseId = courses.some((course) => course.course_id === selectedCourseId) ? selectedCourseId : ''
  const course = courses.find((row) => row.course_id === activeCourseId)
  const canUse = course?.allowed_actions.includes('analysis.use') ?? false
  const occurrencesQuery = useQuery({
    queryKey: ['feedback-chat-occurrences', environment.name, activeCourseId],
    queryFn: async ({ signal }) => protectedRequest(() => api.occurrences(activeCourseId, signal)),
    enabled: verified && canUse && Boolean(activeCourseId) && !signedOut,
    retry: false,
  })
  const chatsQuery = useQuery({
    queryKey: ['feedback-chats', environment.name, activeCourseId],
    queryFn: async ({ signal }) => protectedRequest(() => api.chats(activeCourseId, signal)),
    enabled: verified && canUse && Boolean(activeCourseId) && !signedOut,
    retry: false,
  })
  const summaries = chatsQuery.data?.chats ?? emptyChats
  const selectedChatSummary = summaries.find((chat) => chat.id === selectedChatId)
  const activeChatId = selectedChatSummary?.id ?? (selectedChatId ? '' : summaries[0]?.id ?? '')
  const chatQuery = useQuery({
    queryKey: ['feedback-chat', environment.name, activeCourseId, activeChatId],
    queryFn: async ({ signal }) => protectedRequest(() => api.chat(activeCourseId, activeChatId, signal)),
    enabled: verified && canUse && Boolean(activeCourseId) && Boolean(activeChatId) && !signedOut,
    retry: false,
  })
  const chat = chatQuery.data
  const maxNewSources = Math.max(0, 20 - (chat?.sources.length ?? 0))
  const storedJobKey = activeChatId ? qualifyBrowserKey(environment.name, `feedback-chat-job:${activeChatId}`) : ''
  const jobQuery = useQuery({
    queryKey: ['feedback-chat-job', environment.name, activeCourseId, activeJobId],
    queryFn: async ({ signal }) => protectedRequest(() => api.job(activeCourseId, activeJobId, signal)),
    enabled: Boolean(activeJobId) && Boolean(activeCourseId) && !signedOut,
    refetchInterval: (query) => ['pending', 'running'].includes(query.state.data?.status ?? '') ? 1000 : false,
    retry: false,
  })
  const createChatMutation = useMutation({
    mutationFn: () => api.createChat(activeCourseId, {}),
    onSuccess: async (created) => {
      queryClient.setQueryData(['feedback-chat', environment.name, activeCourseId, created.id], created)
      queryClient.setQueryData<{ chats: FeedbackChatSummary[] }>(['feedback-chats', environment.name, activeCourseId], (current) => ({
        chats: [created, ...(current?.chats ?? []).filter((summary) => summary.id !== created.id).map(({ id, title, updated_at }) => ({ id, title, updated_at }))],
      }))
      setSelectedChatId(created.id)
      setNotice('')
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['feedback-chats', environment.name, activeCourseId] })
    },
    onError: (cause) => handleMutationError(cause),
  })
  const renameMutation = useMutation({
    mutationFn: ({ chatId, title }: { chatId: string; title: string }) => api.renameChat(activeCourseId, chatId, { title }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['feedback-chat', environment.name, activeCourseId, updated.id], updated)
      queryClient.setQueryData<{ chats: FeedbackChatSummary[] }>(['feedback-chats', environment.name, activeCourseId], (current) => current && ({
        chats: current.chats.map((summary) => summary.id === updated.id ? { id: updated.id, title: updated.title, updated_at: updated.updated_at } : summary),
      }))
      await queryClient.invalidateQueries({ queryKey: ['feedback-chats', environment.name, activeCourseId] })
    },
  })
  const archiveMutation = useMutation({
    mutationFn: (chatId: string) => api.archiveChat(activeCourseId, chatId),
    onSuccess: async (_, chatId) => {
      queryClient.setQueryData<{ chats: FeedbackChatSummary[] }>(['feedback-chats', environment.name, activeCourseId], (current) => current && ({
        chats: current.chats.filter((summary) => summary.id !== chatId),
      }))
      if (chatId === activeChatId) setSelectedChatId('')
      await queryClient.invalidateQueries({ queryKey: ['feedback-chats', environment.name, activeCourseId] })
    },
    onError: (cause) => handleMutationError(cause),
  })
  const scopeMutation = useMutation({
    mutationFn: ({ chatId, occurrenceIds }: { chatId: string; occurrenceIds: string[] }) => api.addChatScope(activeCourseId, chatId, { occurrence_ids: occurrenceIds }),
    onSuccess: async (updated) => {
      setSelectedOccurrenceId('')
      setScopeOpen(false)
      setScopeSelection([])
      setNotice('Source added for future questions in this Chat.')
      queryClient.setQueryData(['feedback-chat', environment.name, activeCourseId, updated.id], updated)
      await queryClient.invalidateQueries({ queryKey: ['feedback-chat', environment.name, activeCourseId, activeChatId] })
    },
    onError: (cause) => handleMutationError(cause),
  })
  const turnMutation = useMutation({
    mutationFn: ({ text, retryMessageId }: { text: string; retryMessageId?: string }) => {
      const attempt = turnAttempt.current
      if (!attempt || attempt.courseId !== activeCourseId || attempt.chatId !== activeChatId || attempt.text !== text || attempt.retryMessageId !== retryMessageId) {
        throw new Error('Feedback Chat turn attempt is missing or changed.')
      }
      return api.createTurn(activeCourseId, activeChatId, { content: text, ...(retryMessageId ? { retry_message_id: retryMessageId } : {}) }, attempt.key)
    },
    onSuccess: async (result) => {
      turnAttempt.current = null
      setActiveJobId(result.job_id)
      if (storedJobKey) sessionStorage.setItem(storedJobKey, result.job_id)
      setComposerText('')
      setError('')
      setNotice('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['feedback-chat', environment.name, activeCourseId, activeChatId] }),
        queryClient.invalidateQueries({ queryKey: ['feedback-chats', environment.name, activeCourseId] }),
      ])
    },
    onError: (cause) => handleMutationError(cause),
  })

  function handleMutationError(cause: unknown) {
    if (cause instanceof AuthenticationRequiredError) clearSession('Your session ended. Sign in again.')
    else if (cause instanceof InstructorApiError && cause.status === 404) setError('You no longer have access to this course or Chat. Refresh your course list and try again.')
    else if (cause instanceof InstructorApiError && cause.status === 409) setError('This turn conflicted with a previous request. Review the conversation and retry.')
    else setError('The request could not be completed. Please try again.')
  }

  useEffect(() => {
    if (!chatsQuery.data) return
    if (selectedChatId && !summaries.some((summary) => summary.id === selectedChatId)) setSelectedChatId('')
    if (!selectedChatId && summaries.length) setSelectedChatId(summaries[0].id)
  }, [chatsQuery.data, selectedChatId, summaries])

  useEffect(() => {
    if (!activeChatId || !storedJobKey) return
    setActiveJobId(sessionStorage.getItem(storedJobKey) ?? '')
  }, [activeChatId, storedJobKey])

  useEffect(() => {
    if (!chat || promptDraftChatId.current === chat.id) return
    promptDraftChatId.current = chat.id
    setPromptDraft(chat.prompt_override ?? '')
  }, [chat])

  useEffect(() => {
    if (!chat || !selectedOccurrenceId || deepLinkApplied.current || !activeChatId) return
    if (chat.sources.some((source) => source.id === selectedOccurrenceId)) { deepLinkApplied.current = true; return }
    if (chat.sources.length < 20 && occurrencesQuery.data?.occurrences.some((source) => source.id === selectedOccurrenceId)) {
      deepLinkApplied.current = true
      scopeMutation.mutate({ chatId: activeChatId, occurrenceIds: [selectedOccurrenceId] })
    }
  }, [activeChatId, chat, occurrencesQuery.data, scopeMutation, selectedOccurrenceId])

  useEffect(() => {
    const status = jobQuery.data?.status
    if (status === 'completed') {
      void queryClient.invalidateQueries({ queryKey: ['feedback-chat', environment.name, activeCourseId, activeChatId] })
      if (storedJobKey) sessionStorage.removeItem(storedJobKey)
      setActiveJobId('')
      setNotice('Answer complete.')
    }
    if (status === 'failed') setError('This answer could not be completed. You can retry the same question.')
  }, [activeChatId, activeCourseId, environment.name, jobQuery.data?.status, queryClient, storedJobKey])

  function send(text = composerText, retryMessageId?: string) {
    const value = text.trim()
    if (!activeCourseId || !activeChatId || !value || value.length > 3000 || turnMutation.isPending) return
    const previousAttempt = turnAttempt.current
    const sameAttempt = previousAttempt?.courseId === activeCourseId
      && previousAttempt.chatId === activeChatId
      && previousAttempt.text === value
      && previousAttempt.retryMessageId === retryMessageId
    if (!sameAttempt) {
      turnAttempt.current = {
        courseId: activeCourseId,
        chatId: activeChatId,
        text: value,
        retryMessageId,
        key: crypto.randomUUID(),
      }
    }
    turnMutation.mutate({ text: value, retryMessageId })
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send()
  }
  function composerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }
  function addSelectedSource() {
    const ids = scopeSelection.filter((id) => !chat?.sources.some((source) => source.id === id)).slice(0, maxNewSources)
    if (!ids.length || !activeChatId) return
    scopeMutation.mutate({ chatId: activeChatId, occurrenceIds: ids })
  }
  async function savePrompt() {
    if (!chat || promptDraft === null) return
    try {
      await api.renameChat(activeCourseId, chat.id, { prompt_override: promptDraft.trim() || null })
      setNotice('Chat instructions saved.')
      await queryClient.invalidateQueries({ queryKey: ['feedback-chat', environment.name, activeCourseId, chat.id] })
      setPromptOpen(false)
    } catch (cause) { handleMutationError(cause) }
  }
  function openCitation(citation: ChatCitationSource) {
    const match = chat?.messages.flatMap((message) => message.citations).find((item) => item.id === citation.citationId)
    if (!match) return
    const query = new URLSearchParams({ course_id: activeCourseId, occurrence_id: match.occurrence_id, response_id: match.response_id })
    if (match.response_message_id !== null) query.set('response_message_id', String(match.response_message_id))
    window.open(toAppHref(environment, `FeedbackAnalyzer.html?${query.toString()}`), '_blank', 'noopener')
  }
  function downloadMarkdown() {
    if (!chat) return
    const blob = new Blob([exportMarkdown(chat)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${chat.title.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'feedback-chat'}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  async function saveRename(chatId: string, title: string) {
    await renameMutation.mutateAsync({ chatId, title })
  }
  function archiveChat(chatId: string) {
    setArchiveTarget(chatId)
  }
  const job = jobQuery.data
  const busy = turnMutation.isPending || job?.status === 'pending' || job?.status === 'running'
  const voice = useChatVoiceInput({ value: composerText, onValueChange: setComposerText,
    disabled: !verified || !canUse || !chat?.sources.length || busy, contextKey: activeChatId })
  const latestUserMessage = [...(chat?.messages ?? [])].reverse().find((message) => message.role === 'user')
  const availableSources = occurrencesQuery.data?.occurrences ?? []
  const sessionList = (mobile: boolean) => <ChatSessionList sessions={summaries} selectedSessionId={activeChatId || null} status={chatsQuery.isPending ? 'loading' : chatsQuery.isError ? 'error' : 'ready'} onCreateSession={() => { if (mobile) setSessionsOpen(false); createChatMutation.mutate() }} onSelectSession={(id) => { setSelectedChatId(id); setError(''); if (mobile) setSessionsOpen(false) }} onRenameSession={saveRename} onArchiveSession={(id) => { if (mobile) setSessionsOpen(false); archiveChat(id) }} onRetry={() => void chatsQuery.refetch()} />

  if (!verified) return <p className="mt-6 text-base text-muted-foreground">Waiting for backend identity verification before opening instructor feedback.</p>
  if (signedOut) return <p className="mt-6 text-base text-muted-foreground" role="status">Returning to sign-in…</p>
  const visibleError = error || (courseQuery.isError && !(courseQuery.error instanceof AuthenticationRequiredError) ? 'Could not load your courses. Please retry.' : '')
  const firstLoad = courseQuery.isPending
  return <div className="mt-4 space-y-3">
    {visibleError && <p className="text-base text-destructive" role="alert">{visibleError}</p>}
    {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}
    {firstLoad ? <p className="text-base" role="status">Loading courses…</p> : courseQuery.isError ? <Button onClick={() => void courseQuery.refetch()} type="button" variant="outline">Retry loading courses</Button> : !courses.length ? <p className="text-base text-muted-foreground">No active courses are available for this account.</p> : !canUse ? <p className="text-base text-muted-foreground">You do not have permission to use Feedback Chat for this course.</p> : (<>
      <Button className="lg:hidden" onClick={() => setSessionsOpen(true)} type="button" variant="outline"><MessagesSquare aria-hidden="true" className="size-4" />Show sessions</Button>
      <Sheet onOpenChange={setSessionsOpen} open={sessionsOpen}><SheetContent className="w-[min(20rem,88vw)] gap-0 bg-muted p-0" side="left"><SheetHeader className="border-b border-border bg-card"><SheetTitle>Chats</SheetTitle><SheetDescription>Select or create a Feedback Chat session.</SheetDescription></SheetHeader>{sessionList(true)}</SheetContent></Sheet>
      <section aria-label="Feedback Chat workspace" className="grid min-h-[38rem] min-w-0 overflow-hidden rounded-md border border-border bg-card lg:h-[calc(100svh-11rem)] lg:grid-cols-[13.75rem_minmax(0,1fr)]">
        <div className="hidden min-h-0 min-w-0 border-r border-border bg-muted lg:block">
          {sessionList(false)}
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          {!activeChatId ? <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-base text-muted-foreground"><MessagesSquare aria-hidden="true" className="size-12 text-border" /><h2 className="font-semibold text-foreground">Ask about your survey data</h2><p>Choose a Chat or create a new one to start.</p></div> : chatQuery.isPending ? <p className="p-6 text-base" role="status">Loading conversation…</p> : chatQuery.isError || !chat ? <Card><CardContent className="space-y-3 py-6"><p className="text-base text-destructive">This Chat could not be loaded.</p><Button onClick={() => void chatQuery.refetch()} type="button" variant="outline">Retry loading Chat</Button></CardContent></Card> : (
            <>
              <div className="shrink-0 border-b border-border px-4 py-3 sm:px-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-lg font-bold">{chat.title}</h2>
                  <div className="flex flex-wrap gap-1">
                    <Button onClick={() => { setTitleDraft(chat.title); setRenameOpen(true) }} size="sm" type="button" variant="ghost">Rename</Button>
                    <Button onClick={downloadMarkdown} size="sm" type="button" variant="ghost">Export</Button>
                    <Button onClick={() => archiveChat(chat.id)} size="sm" type="button" variant="ghost">Archive</Button>
                    <Button aria-label="Create another Chat" onClick={() => { setError(''); setNotice(''); createChatMutation.mutate() }} size="sm" type="button" variant="outline">New chat</Button>
                  </div>
                </div>
                <Button className="mt-2 gap-2" onClick={() => { setScopeSelection([]); setScopeOpen(true) }} type="button" variant="outline">
                  {chat.sources.length ? `${chat.sources.length} feedback source${chat.sources.length === 1 ? '' : 's'}` : 'Choose chat context'} <span className="text-sm text-muted-foreground">Change</span><ChevronDown aria-hidden="true" className="size-4" />
                </Button>
                {chat.sources.length > 0 && <ul aria-label="Chat sources" className="mt-2 flex flex-wrap gap-2">{chat.sources.map((source) => <li className="rounded-md bg-muted px-2 py-1 text-sm text-muted-foreground" key={source.id}>{source.label}</li>)}</ul>}
                {occurrencesQuery.isError && <p className="mt-2 text-base text-destructive" role="alert">Course sources could not be loaded. <Button className="h-auto p-0" onClick={() => void occurrencesQuery.refetch()} type="button" variant="link">Retry</Button></p>}
              </div>
              <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 shadow-none">
                <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 p-0">
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <ChatTranscript className="student-transcript mx-auto flex w-full max-w-[832px] flex-col gap-7 px-5 py-10 sm:gap-8 sm:px-0 sm:py-12">
                      {chat.messages.length === 0 && <div className="flex flex-col items-center gap-3 py-16 text-center"><MessagesSquare aria-hidden="true" className="size-12 text-border" /><h3 className="font-semibold">Ask about your survey data</h3><p className="text-base text-muted-foreground">Choose a feedback source, then ask your first question.</p></div>}
                      {chat.messages.map((message) => <ChatMessage author={message.role === 'assistant' ? 'Feedback Chat' : 'Instructor'} className={message.role === 'assistant' ? 'student-assistant-message' : 'student-user-message'} key={message.id} metaClassName="student-message-meta" role={message.role} timestamp={message.created_at}>
                        <div className="w-full space-y-3 text-base leading-7">
                          {message.role === 'assistant'
                            ? <div className="ml-1 border-l border-border/60 py-0.5 pl-7">{renderAssistantMarkdown(message.content, message.citations, openCitation)}</div>
                            : <p className="ml-auto w-full max-w-[83%] whitespace-pre-wrap break-words rounded bg-muted px-5 py-4 text-base leading-7">{message.content}</p>}
                          {message.citations.some((citation) => !message.content.includes(`[${citation.citation_number}]`)) && <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2"><span className="text-sm text-muted-foreground">Evidence:</span>{message.citations.filter((citation) => !message.content.includes(`[${citation.citation_number}]`)).map((citation) => <ChatCitation citation={asCitationSource(citation)} key={citation.id} onOpenSource={openCitation} />)}</div>}
                        </div>
                      </ChatMessage>)}
                    </ChatTranscript>
                    <div className="mx-auto flex w-full max-w-[832px] flex-wrap items-center gap-2 px-5 pb-4 sm:px-8">
                      {busy && <p className="text-sm text-muted-foreground" role="status">Working on your answer…</p>}
                      {job?.status === 'failed' && latestUserMessage && <Button disabled={turnMutation.isPending} onClick={() => send(latestUserMessage.content, latestUserMessage.id)} type="button" variant="outline">Retry last question</Button>}
                      {chat.messages.length > 0 && latestUserMessage && job?.status !== 'failed' && <Button className="text-base" disabled={busy} onClick={() => send(latestUserMessage.content, latestUserMessage.id)} type="button" variant="link">Replay last question</Button>}
                    </div>
                  </div>
                  <div className="shrink-0 space-y-3 border-t border-border bg-card p-4 sm:px-7">
                    <div className="flex flex-wrap gap-2" aria-label="Suggested questions">{['What themes are emerging?', 'What could be clearer for students?'].map((prompt) => <Button key={prompt} onClick={() => setComposerText(prompt)} type="button" variant="outline">{prompt}</Button>)}</div>
                    <div className="legacy-student">
                      <form onSubmit={submit}>
                        <ChatComposer busy={busy} className="bg-background" disabled={!chat.sources.length || busy} maxLength={3000} onKeyDown={composerKeyDown} onValueChange={setComposerText} placeholder={chat.sources.length ? 'Ask about the selected feedback sources…' : 'Add a feedback source to begin'} sendDisabled={!composerText.trim() || !chat.sources.length} value={composerText} voiceInput={voice.voiceInput} />
                      </form>
                    </div>
                    {voice.error && <p className="text-sm text-destructive" role="alert">{voice.error}</p>}
                    <div className="flex items-center justify-between text-sm text-muted-foreground"><Button className="h-auto gap-1 p-0 text-sm" onClick={() => setPromptOpen(true)} type="button" variant="link"><SlidersHorizontal aria-hidden="true" className="size-4" />Chat instructions</Button><span>Shift+Enter for newline</span></div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </section></>
    )}
    <Dialog onOpenChange={setScopeOpen} open={scopeOpen}>
      <DialogContent className="max-h-[min(80vh,46rem)] overflow-hidden sm:max-w-xl">
        <DialogHeader><DialogTitle className="text-lg font-bold">Choose chat context</DialogTitle>
          <DialogDescription>Choose the surveys this Chat can use for future questions. Sources already used in earlier answers stay attached to those answers.</DialogDescription></DialogHeader>
        <div className="flex gap-3 text-sm"><Button onClick={() => setScopeSelection(availableSources.filter((source) => !chat?.sources.some((current) => current.id === source.id)).slice(0, maxNewSources).map((source) => source.id))} type="button" variant="link">Select all available</Button><Button onClick={() => setScopeSelection([])} type="button" variant="link">Clear</Button></div>
        <div className="min-h-32 max-h-80 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {availableSources.length === 0 && <p className="p-4 text-base text-muted-foreground">No feedback surveys are available for this course.</p>}
          {availableSources.map((source) => {
            const existing = chat?.sources.some((current) => current.id === source.id) ?? false
            return <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-base hover:bg-muted" key={source.id}>
              <input checked={existing || scopeSelection.includes(source.id)} disabled={existing || (!scopeSelection.includes(source.id) && scopeSelection.length >= maxNewSources)} onChange={(event) => setScopeSelection((selected) => event.target.checked ? [...selected, source.id].slice(0, maxNewSources) : selected.filter((id) => id !== source.id))} type="checkbox" />
              <span className="min-w-0 flex-1 truncate">{source.label}</span>{existing && <span className="text-sm text-muted-foreground">Added</span>}
            </label>
          })}
        </div>
        <DialogFooter className="-mx-4 -mb-4"><span className="mr-auto text-sm text-muted-foreground">{scopeSelection.length} of {maxNewSources} new sources selected</span><Button onClick={() => setScopeOpen(false)} type="button" variant="outline">Cancel</Button><Button disabled={!scopeSelection.length || scopeMutation.isPending} onClick={addSelectedSource} type="button">{scopeMutation.isPending ? 'Saving…' : 'Save'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog onOpenChange={setPromptOpen} open={promptOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-lg font-bold">Chat instructions</DialogTitle><DialogDescription>Customize how LEAI responds. Changes apply to future messages in this Chat.</DialogDescription></DialogHeader>
        <label className="block space-y-2 text-base font-medium">Optional instructions for this Chat
          <Textarea className="min-h-44 font-mono text-base" maxLength={4000} onChange={(event) => setPromptDraft(event.target.value)} placeholder="Use plain language and focus on actionable themes." value={promptDraft ?? ''} />
        </label>
        <DialogFooter className="-mx-4 -mb-4"><Button onClick={() => setPromptDraft('')} type="button" variant="ghost">Restore default</Button><Button disabled={!latestUserMessage || busy} onClick={() => { if (latestUserMessage) send(latestUserMessage.content, latestUserMessage.id); setPromptOpen(false) }} type="button" variant="ghost">Replay last turn</Button><Button disabled={promptDraft === null || promptDraft === (chat?.prompt_override ?? '')} onClick={() => { void savePrompt() }} type="button">Save instructions</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog onOpenChange={setRenameOpen} open={renameOpen}>
      <DialogContent><DialogHeader><DialogTitle>Rename Chat</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (chat && titleDraft.trim()) void saveRename(chat.id, titleDraft.trim()).then(() => setRenameOpen(false)).catch(handleMutationError) }}>
          <Input aria-label="Chat title" maxLength={120} onChange={(event) => setTitleDraft(event.target.value)} value={titleDraft} />
          <DialogFooter className="-mx-4 -mb-4"><Button onClick={() => setRenameOpen(false)} type="button" variant="outline">Cancel</Button><Button disabled={!titleDraft.trim() || renameMutation.isPending} type="submit">Save title</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog onOpenChange={(open) => { if (!open) setArchiveTarget('') }} open={Boolean(archiveTarget)}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archive this Chat?</AlertDialogTitle><AlertDialogDescription>The Chat will leave your recent list. Its stored messages and citations remain available to administrators.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { archiveMutation.mutate(archiveTarget); setArchiveTarget('') }}>Archive Chat</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
