import type { ReactNode } from 'react'

export type ChatMessageRole = 'assistant' | 'user'

function formatChatMessageTime(timestamp?: string) {
  return new Date(timestamp ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatMessage({ role, author, timestamp, children, className = '', metaClassName = '' }: {
  role: ChatMessageRole
  author: string
  timestamp?: string
  children: ReactNode
  className?: string
  metaClassName?: string
}) {
  const assistant = role === 'assistant'
  return <li className={`chat-message flex flex-col gap-1.5 ${assistant ? '' : 'items-end'} ${className}`.trim()} data-chat-role={role}>
    <span className={`chat-message-meta flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${assistant ? 'text-primary' : 'text-muted-foreground'} ${metaClassName}`}>
      {assistant && <span aria-hidden="true" className="size-2 rounded-full bg-primary" />}
      {author} <time>{formatChatMessageTime(timestamp)}</time>
    </span>
    {children}
  </li>
}
