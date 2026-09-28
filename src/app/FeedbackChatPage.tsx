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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatTranscript } from '@/components/chat/ChatTranscript'
import { ChatCitation, type ChatCitationSource } from './feedback-chat/ChatCitation'
import { ChatSessionList } from './feedback-chat/ChatSessionList'
import { qualifyBrowserKey, toAppHref, type PublicEnvironment } from '@/config/environment'

type Id = string
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

function inlineMarkdown(text: string) {
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  return text.split(tokenPattern).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`')) return <code className="rounded bg-muted px-1" key={index}>{part.slice(1, -1)}</code>
    return <span key={index}>{part}</span>
  })
}

function renderAssistantMarkdown(markdown: string) {
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
      if (block.level === 1) return <h3 className={className} key={index}>{inlineMarkdown(block.text)}</h3>
      if (block.level === 2) return <h4 className={className} key={index}>{inlineMarkdown(block.text)}</h4>
      return <h5 className={className} key={index}>{inlineMarkdown(block.text)}</h5>
    }
    if (block.type === 'list') return <ul className="list-disc space-y-1 pl-5" key={index}>{block.text.split('\n').map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}</ul>
    return <p className="whitespace-pre-wrap" key={index}>{inlineMarkdown(block.text)}</p>
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
  const [selectedCourseId, setSelectedCourseId] = useState(() => params.get('course_id') ?? sessionStorage.getItem(courseKey) ?? '')
  const [selectedChatId, setSelectedChatId] = useState(() => params.get('chat_id') ?? '')
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState(() => params.get('occurrence_id') ?? '')
  const [composerText, setComposerText] = useState('')
  const [promptDraft, setPromptDraft] = useState<string | null>(null)
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
    setSelectedCourseId('')
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
  const activeCourseId = courses.find((course) => course.course_id === selectedCourseId)?.course_id ?? courses[0]?.course_id ?? ''
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
  const summaries = chatsQuery.data?.chats ?? []
  const selectedChatSummary = summaries.find((chat) => chat.id === selectedChatId)
  const activeChatId = selectedChatSummary?.id ?? (selectedChatId ? '' : summaries[0]?.id ?? '')
  const chatQuery = useQuery({
    queryKey: ['feedback-chat', environment.name, activeCourseId, activeChatId],
    queryFn: async ({ signal }) => protectedRequest(() => api.chat(activeCourseId, activeChatId, signal)),
    enabled: verified && canUse && Boolean(activeCourseId) && Boolean(activeChatId) && !signedOut,
    retry: false,
  })
  const chat = chatQuery.data
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
    mutationFn: ({ chatId, occurrenceId }: { chatId: string; occurrenceId: string }) => api.addChatScope(activeCourseId, chatId, { occurrence_ids: [occurrenceId] }),
    onSuccess: async (updated) => {
      setSelectedOccurrenceId('')
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
    if (!courseQuery.data) return
    if (activeCourseId) {
      sessionStorage.setItem(courseKey, activeCourseId)
      if (activeCourseId !== selectedCourseId) setSelectedCourseId(activeCourseId)
    } else sessionStorage.removeItem(courseKey)
  }, [activeCourseId, courseKey, courseQuery.data, selectedCourseId])

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
    if (occurrencesQuery.data?.occurrences.some((source) => source.id === selectedOccurrenceId)) {
      deepLinkApplied.current = true
      scopeMutation.mutate({ chatId: activeChatId, occurrenceId: selectedOccurrenceId })
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

  async function signOut() {
    try { await api.logout(); clearSession() }
    catch (cause) { if (cause instanceof AuthenticationRequiredError) clearSession(); else setError('Sign-out could not finish. Please try again.') }
  }
  function chooseCourse(id: string) {
    setSelectedCourseId(id)
    setSelectedChatId('')
    setActiveJobId('')
    sessionStorage.setItem(courseKey, id)
    setError('')
  }
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
    if (!selectedOccurrenceId || !activeChatId || chat?.sources.some((source) => source.id === selectedOccurrenceId)) return
    scopeMutation.mutate({ chatId: activeChatId, occurrenceId: selectedOccurrenceId })
  }
  async function savePrompt() {
    if (!chat || promptDraft === null) return
    try {
      await api.renameChat(activeCourseId, chat.id, { prompt_override: promptDraft.trim() || null })
      setNotice('Chat instructions saved.')
      await queryClient.invalidateQueries({ queryKey: ['feedback-chat', environment.name, activeCourseId, chat.id] })
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
    if (window.confirm('Archive this Chat? Its message and citation history will remain available only in stored records.')) archiveMutation.mutate(chatId)
  }
  const job = jobQuery.data
  const busy = turnMutation.isPending || job?.status === 'pending' || job?.status === 'running'
  const latestUserMessage = [...(chat?.messages ?? [])].reverse().find((message) => message.role === 'user')
  const alreadyScoped = chat?.sources.some((source) => source.id === selectedOccurrenceId) ?? false

  if (!verified) return <p className="mt-6 text-base text-muted-foreground">Waiting for backend identity verification before opening instructor feedback.</p>
  if (signedOut) return <p className="mt-6 text-base text-muted-foreground" role="status">Returning to sign-in…</p>
  const visibleError = error || (courseQuery.isError && !(courseQuery.error instanceof AuthenticationRequiredError) ? 'Could not load your courses. Please retry.' : '')
  const firstLoad = courseQuery.isPending
  return <div className="mt-6 space-y-5">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 space-y-1.5 text-base font-medium">Course
        <select aria-label="Course" className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base focus-visible:ring-3 focus-visible:ring-ring/50" disabled={firstLoad || courses.length === 0} onChange={(event) => chooseCourse(event.target.value)} value={activeCourseId}>
          {courses.length === 0 && <option value="">No courses available</option>}
          {courses.map((row) => <option key={row.course_id} value={row.course_id}>{row.course_name} · {row.course_code}</option>)}
        </select>
      </label>
      <Button onClick={() => void signOut()} type="button" variant="outline">Sign out</Button>
    </div>
    {visibleError && <p className="text-base text-destructive" role="alert">{visibleError}</p>}
    {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}
    {firstLoad ? <p className="text-base" role="status">Loading courses…</p> : courseQuery.isError ? <Button onClick={() => void courseQuery.refetch()} type="button" variant="outline">Retry loading courses</Button> : !courses.length ? <p className="text-base text-muted-foreground">No active courses are available for this account.</p> : !canUse ? <p className="text-base text-muted-foreground">You do not have permission to use Feedback Chat for this course.</p> : (
      <div className="grid min-w-0 gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Card className="min-w-0 self-start">
          <CardHeader><CardTitle>Feedback Chat</CardTitle><CardDescription>Ask questions about anonymous course feedback.</CardDescription></CardHeader>
          <CardContent><ChatSessionList sessions={summaries} selectedSessionId={activeChatId || null} status={chatsQuery.isPending ? 'loading' : chatsQuery.isError ? 'error' : 'ready'} onCreateSession={() => createChatMutation.mutate()} onSelectSession={(id) => { setSelectedChatId(id); setError('') }} onRenameSession={saveRename} onArchiveSession={archiveChat} onRetry={() => void chatsQuery.refetch()} /></CardContent>
        </Card>
        <div className="min-w-0 space-y-4">
          {!activeChatId ? <Card><CardContent className="py-8 text-base text-muted-foreground">Choose a Chat or create a new one to start.</CardContent></Card> : chatQuery.isPending ? <p className="text-base" role="status">Loading conversation…</p> : chatQuery.isError || !chat ? <Card><CardContent className="space-y-3 py-6"><p className="text-base text-destructive">This Chat could not be loaded.</p><Button onClick={() => void chatQuery.refetch()} type="button" variant="outline">Retry loading Chat</Button></CardContent></Card> : (
            <>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div><CardTitle>{chat.title}</CardTitle><CardDescription>Add sources here to use them for future questions in this Chat.</CardDescription></div>
                  <div className="flex flex-wrap gap-2"><Button onClick={downloadMarkdown} type="button" variant="outline">Export Markdown</Button><Button onClick={() => { setError(''); setNotice(''); createChatMutation.mutate() }} type="button">New chat</Button></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-48 flex-1 space-y-1.5 text-base font-medium">Add a course source
                      <select aria-label="Add a course source" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-base" disabled={occurrencesQuery.isPending || scopeMutation.isPending} onChange={(event) => setSelectedOccurrenceId(event.target.value)} value={selectedOccurrenceId}>
                        <option value="">Select a week or survey</option>
                        {(occurrencesQuery.data?.occurrences ?? []).map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
                      </select>
                    </label>
                    <Button disabled={!selectedOccurrenceId || alreadyScoped || scopeMutation.isPending} onClick={addSelectedSource} type="button" variant="outline">{scopeMutation.isPending ? 'Adding source…' : 'Add source'}</Button>
                  </div>
                  {occurrencesQuery.isError && <p className="text-base text-destructive" role="alert">Course sources could not be loaded. <Button className="h-auto p-0" onClick={() => void occurrencesQuery.refetch()} type="button" variant="link">Retry</Button></p>}
                  {chat.sources.length > 0 ? <ul aria-label="Chat sources" className="flex flex-wrap gap-2">{chat.sources.map((source) => <li className="rounded-full border border-border bg-muted px-3 py-1 text-sm" key={source.id}>{source.label}</li>)}</ul> : <p className="text-base text-muted-foreground">No feedback sources yet. Add a course source before asking about student responses.</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Conversation</CardTitle><CardDescription>Each answer uses the sources captured when that question was sent.</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                  <ChatTranscript className="space-y-5">
                    {chat.messages.map((message) => <ChatMessage author={message.role === 'assistant' ? 'Feedback Chat' : 'Instructor'} className="rounded-xl border border-border bg-background p-4" key={message.id} role={message.role} timestamp={message.created_at}>
                      <div className="space-y-3 text-base leading-7">{message.role === 'assistant' ? renderAssistantMarkdown(message.content) : <p className="whitespace-pre-wrap">{message.content}</p>}
                        {message.citations.length > 0 && <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2"><span className="text-sm text-muted-foreground">Evidence:</span>{message.citations.map((citation) => <ChatCitation citation={{ citationId: citation.id, citationNumber: citation.citation_number, responseExcerpt: citation.evidence_quote, weekLabel: citation.week_label ?? undefined, surveyLabel: citation.survey_label ?? undefined, questionLabel: citation.question_label ?? undefined }} key={citation.id} onOpenSource={openCitation} />)}</div>}
                      </div>
                    </ChatMessage>)}
                  </ChatTranscript>
                  {busy && <p className="text-sm text-muted-foreground" role="status">Working on your answer…</p>}
                  {job?.status === 'failed' && latestUserMessage && <Button disabled={turnMutation.isPending} onClick={() => send(latestUserMessage.content, latestUserMessage.id)} type="button" variant="outline">Retry last question</Button>}
                  {chat.messages.length > 0 && latestUserMessage && job?.status !== 'failed' && <Button className="text-base" disabled={busy} onClick={() => send(latestUserMessage.content, latestUserMessage.id)} type="button" variant="link">Replay last question</Button>}
                  <div className="flex flex-wrap gap-2" aria-label="Suggested questions">{['What themes are emerging?', 'What could be clearer for students?'].map((prompt) => <Button key={prompt} onClick={() => setComposerText(prompt)} type="button" variant="outline">{prompt}</Button>)}</div>
                  <form onSubmit={submit}>
                    <ChatComposer busy={busy} disabled={!chat.sources.length || busy} maxLength={3000} onKeyDown={composerKeyDown} onValueChange={setComposerText} placeholder={chat.sources.length ? 'Ask about the selected feedback sources…' : 'Add a feedback source to begin'} sendDisabled={!composerText.trim() || !chat.sources.length} value={composerText} />
                  </form>
                  <details className="rounded-lg border border-border p-3">
                    <summary className="cursor-pointer text-base font-medium">Chat instructions</summary>
                    <div className="mt-3 space-y-2"><label className="block space-y-1 text-base font-medium">Optional instructions for this Chat
                      <Textarea maxLength={4000} onChange={(event) => setPromptDraft(event.target.value)} placeholder="Use plain language and focus on actionable themes." value={promptDraft ?? ''} />
                    </label><Button disabled={promptDraft === null || promptDraft === (chat.prompt_override ?? '')} onClick={() => void savePrompt()} type="button" variant="outline">Save instructions</Button></div>
                  </details>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    )}
  </div>
}
