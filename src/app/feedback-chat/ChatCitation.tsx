import { EvidenceCitation } from '@/components/product/EvidenceCitation'

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
  const meta = [
    citation.weekLabel ? { label: 'Week', value: citation.weekLabel } : null,
    citation.surveyLabel ? { label: 'Survey', value: citation.surveyLabel } : null,
    citation.questionLabel ? { label: 'Question', value: citation.questionLabel } : null,
  ].filter((item): item is { label: string; value: string } => item !== null)
  return <EvidenceCitation ariaLabel={`Open citation ${citation.citationNumber}`} excerpt={citation.responseExcerpt}
    label={String(citation.citationNumber)} meta={meta} onOpenSource={onOpenSource ? () => onOpenSource(citation) : undefined} />
}
