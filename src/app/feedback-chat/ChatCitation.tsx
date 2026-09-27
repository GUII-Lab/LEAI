import { useId } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
} from '@/components/ui/popover'

export type ChatCitationSource = {
  citationId: string
  citationNumber: number
  responseExcerpt: string
  weekLabel?: string
  surveyLabel?: string
  questionLabel?: string
}

type ChatCitationProps = {
  citation: ChatCitationSource
  onOpenSource?: (citation: ChatCitationSource) => void
}

export function ChatCitation({ citation, onOpenSource }: ChatCitationProps) {
  const titleId = useId()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={`Open citation ${citation.citationNumber}`}
          className="h-auto px-1 align-baseline"
          type="button"
          variant="link"
        >
          Source {citation.citationNumber}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-labelledby={titleId} className="max-w-sm break-words">
        <PopoverHeader>
          <h3 className="font-medium" id={titleId}>Source {citation.citationNumber}</h3>
        </PopoverHeader>
        {(citation.weekLabel || citation.surveyLabel || citation.questionLabel) && (
          <dl className="grid gap-1 text-xs text-muted-foreground">
            {citation.weekLabel && (
              <div className="flex gap-1">
                <dt className="font-medium text-foreground">Week:</dt>
                <dd>{citation.weekLabel}</dd>
              </div>
            )}
            {citation.surveyLabel && (
              <div className="flex gap-1">
                <dt className="font-medium text-foreground">Survey:</dt>
                <dd>{citation.surveyLabel}</dd>
              </div>
            )}
            {citation.questionLabel && (
              <div className="flex gap-1">
                <dt className="font-medium text-foreground">Question:</dt>
                <dd>{citation.questionLabel}</dd>
              </div>
            )}
          </dl>
        )}
        <blockquote className="border-l-2 border-border pl-3 text-base text-foreground">
          {citation.responseExcerpt}
        </blockquote>
        {onOpenSource && (
          <Button onClick={() => onOpenSource(citation)} type="button" variant="outline">
            Open full response
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
