import type { ReactNode, Ref } from 'react'

export function ChatTranscript({ children, endAnchorRef, className = '' }: {
  children: ReactNode
  endAnchorRef?: Ref<HTMLLIElement>
  className?: string
}) {
  return <ol aria-label="Conversation" aria-live="polite" className={`chat-transcript ${className}`.trim()} data-chat-transcript role="log">
    {children}
    <li aria-hidden="true" ref={endAnchorRef} />
  </ol>
}
