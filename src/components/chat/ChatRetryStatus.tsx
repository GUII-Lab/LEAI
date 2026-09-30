import { Button } from '@/components/ui/button'

export function ChatRetryStatus({ kind, onRetry, busy = false }: {
  kind: 'connection' | 'not-sent' | 'reply' | 'changed'
  onRetry: () => void
  busy?: boolean
}) {
  const caption = kind === 'reply' ? 'Couldn’t generate a reply' : kind === 'not-sent'
    ? 'Not sent' : kind === 'changed' ? 'Conversation changed' : 'Connection lost'
  return <div className="flex items-center gap-1 text-sm text-muted-foreground" role="alert">
    <span>{caption}</span>
    <Button className="min-h-9 px-2 text-sm" disabled={busy} onClick={onRetry} type="button" variant="link">
      {busy ? 'Retrying…' : kind === 'reply' ? 'Try again' : kind === 'changed' ? 'Refresh' : 'Retry'}
    </Button>
  </div>
}
