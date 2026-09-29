import { ChatMessage } from './ChatMessage'
import './chat.css'

export function ChatThinkingMessage() {
  return <ChatMessage author="LEAI" role="assistant">
    <div className="ml-1 border-l border-border/60 py-2 pl-7" role="status" aria-label="LEAI is responding">
      <span className="chat-thinking-dots inline-flex gap-1.5" aria-hidden="true">
        <span /><span /><span />
      </span>
    </div>
  </ChatMessage>
}
