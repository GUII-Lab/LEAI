import { ArrowUp, LoaderCircle, Mic, Square } from 'lucide-react'
import type { KeyboardEventHandler, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import './chat.css'

export type ChatVoiceInput = {
  active: boolean
  available: boolean
  disabled: boolean
  onToggle: () => void
  unsupportedMessage?: string
}

export type ChatSendHint = {
  content: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChatComposer({ value, onValueChange, onKeyDown, placeholder, disabled, sendDisabled, busy = false,
  inputLabel = 'Message', sendLabel = 'Send', sendingLabel = 'Sending message', showInput = true,
  maxLength = 3000, voiceInput, sendHint, className = '' }: {
  value: string
  onValueChange: (value: string) => void
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>
  placeholder: string
  disabled: boolean
  sendDisabled: boolean
  busy?: boolean
  inputLabel?: string
  sendLabel?: string
  sendingLabel?: string
  showInput?: boolean
  maxLength?: number
  voiceInput?: ChatVoiceInput
  sendHint?: ChatSendHint
  className?: string
}) {
  const sendButton = <Button aria-label={busy ? sendingLabel : sendLabel}
    className="chat-composer-send size-10 shrink-0 rounded-full p-0 shadow-sm disabled:opacity-40"
    disabled={disabled || sendDisabled || busy} size="icon" type="submit" variant="ghost">
    {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ArrowUp aria-hidden="true" className="size-5" strokeWidth={2.5} />}
  </Button>

  return <div className={`chat-composer flex flex-col gap-1 rounded-[26px] border border-border/70 bg-card p-2 shadow-sm transition-colors focus-within:border-primary/40 sm:p-2.5 ${className}`.trim()} data-testid="chat-composer">
    {showInput && <label className="block min-w-0">
      <span className="sr-only">{inputLabel}</span>
      <textarea aria-label={inputLabel} className="chat-composer-input block max-h-32 min-h-12 w-full resize-none border-0 bg-transparent px-2.5 py-2 text-[15px] leading-6 outline-none placeholder:text-muted-foreground/75 focus-visible:ring-0 disabled:opacity-60"
        disabled={disabled} maxLength={maxLength} onChange={(event) => onValueChange(event.target.value)} onKeyDown={onKeyDown}
        placeholder={placeholder} value={value} />
    </label>}
    <div className="flex min-h-10 items-center justify-end gap-1.5 px-0.5">
      {voiceInput && <Button aria-label={voiceInput.active ? 'Stop dictation' : 'Dictate'} aria-pressed={voiceInput.active}
        className="chat-composer-voice size-10 shrink-0 rounded-full disabled:opacity-50"
        disabled={disabled || voiceInput.disabled || !voiceInput.available} onClick={voiceInput.onToggle} size="icon" title={voiceInput.available ? 'Dictate' : voiceInput.unsupportedMessage ?? 'Voice input is not supported in this browser'} type="button" variant="ghost">
        {voiceInput.active ? <Square aria-hidden="true" className="size-4" /> : <Mic aria-hidden="true" className="size-5" />}
      </Button>}
      {sendHint ? <Tooltip onOpenChange={sendHint.onOpenChange} open={sendHint.open}>
        <TooltipTrigger asChild>{sendButton}</TooltipTrigger>
        <TooltipContent align="end" side="top" sideOffset={8}>{sendHint.content}</TooltipContent>
      </Tooltip> : sendButton}
    </div>
  </div>
}
