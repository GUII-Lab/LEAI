import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type ChatSessionSummary = {
  id: string
  title: string
}

export type ChatSessionListStatus = 'loading' | 'ready' | 'error'

type ChatSessionListProps = {
  sessions: readonly ChatSessionSummary[]
  selectedSessionId: string | null
  status: ChatSessionListStatus
  onCreateSession: () => void
  onSelectSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void | Promise<void>
  onArchiveSession: (sessionId: string) => void
  onRetry: () => void
}

export function ChatSessionList({
  sessions,
  selectedSessionId,
  status,
  onCreateSession,
  onSelectSession,
  onRenameSession,
  onArchiveSession,
  onRetry,
}: ChatSessionListProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError, setRenameError] = useState(false)
  const renameButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const restoreFocusSessionId = useRef<string | null>(null)

  useEffect(() => {
    if (editingSessionId !== null || restoreFocusSessionId.current === null) return
    renameButtonRefs.current.get(restoreFocusSessionId.current)?.focus()
    restoreFocusSessionId.current = null
  }, [editingSessionId])

  function startRename(session: ChatSessionSummary) {
    restoreFocusSessionId.current = session.id
    setEditingSessionId(session.id)
    setDraftTitle(session.title)
    setRenameError(false)
  }

  function cancelRename() {
    setRenameError(false)
    setEditingSessionId(null)
  }

  async function saveRename(event: FormEvent<HTMLFormElement>, sessionId: string) {
    event.preventDefault()
    const title = draftTitle.trim()
    if (!title || renameSaving) return

    setRenameError(false)
    setRenameSaving(true)
    try {
      await onRenameSession(sessionId, title)
      setEditingSessionId(null)
    } catch {
      setRenameError(true)
    } finally {
      setRenameSaving(false)
    }
  }

  return (
    <section aria-label="Chat sessions" className="flex min-w-0 flex-col gap-3">
      <Button className="w-full" onClick={onCreateSession} type="button">
        New chat
      </Button>

      {status === 'loading' && <p className="text-sm text-muted-foreground" role="status">Loading chats…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-border p-3" role="alert">
          <p className="text-base text-foreground">Chats could not be loaded.</p>
          <Button onClick={onRetry} type="button" variant="outline">Try again</Button>
        </div>
      )}

      {status === 'ready' && sessions.length === 0 && (
        <p className="text-base text-muted-foreground">No chats yet</p>
      )}

      {status === 'ready' && sessions.length > 0 && (
        <ol aria-label="Chat sessions" className="flex min-w-0 flex-col gap-1">
          {sessions.map((session) => {
            const isEditing = editingSessionId === session.id
            const isSelected = selectedSessionId === session.id

            return (
              <li className="flex min-w-0 flex-wrap items-center gap-1 rounded-lg" key={session.id}>
                {isEditing ? (
                  <form className="flex min-w-0 flex-1 flex-wrap items-center gap-1" onSubmit={(event) => saveRename(event, session.id)}>
                    <Input
                      aria-label={`Rename ${session.title}`}
                      autoFocus
                      className="min-w-0 flex-1"
                      disabled={renameSaving}
                      onChange={(event) => {
                        setDraftTitle(event.target.value)
                        setRenameError(false)
                      }}
                      value={draftTitle}
                    />
                    {renameError && (
                      <p className="basis-full text-base text-destructive" role="alert">
                        Title could not be saved. Your draft is still here.
                      </p>
                    )}
                    <Button className="text-base" disabled={renameSaving} size="sm" type="submit" variant="outline">
                      {renameError ? 'Retry save' : renameSaving ? 'Saving title…' : 'Save title'}
                    </Button>
                    <Button
                      className="text-base"
                      disabled={renameSaving}
                      onClick={cancelRename}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Cancel rename
                    </Button>
                  </form>
                ) : (
                  <>
                    <Button
                      aria-pressed={isSelected}
                      className="min-w-0 flex-1 justify-start truncate"
                      onClick={() => onSelectSession(session.id)}
                      type="button"
                      variant={isSelected ? 'secondary' : 'ghost'}
                    >
                      {session.title}
                    </Button>
                    <Button
                      aria-label={`Rename ${session.title}`}
                      onClick={() => startRename(session)}
                      ref={(node) => {
                        if (node) renameButtonRefs.current.set(session.id, node)
                        else renameButtonRefs.current.delete(session.id)
                      }}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`Archive ${session.title}`}
                      className="text-base"
                      onClick={() => onArchiveSession(session.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Archive
                    </Button>
                  </>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
