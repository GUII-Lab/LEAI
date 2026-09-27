import type { StudentSession, StudentSurvey } from '@/api/student'

function safeFilename(label: string) {
  return label.trim().replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'reflection'
}

export async function createStudentDraft(survey: StudentSurvey, session: StudentSession): Promise<Blob> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx')
  const bySequence = new Map(session.messages.map((message) => [message.sequence, message]))
  const questionMessages = session.messages.filter((message) => message.role === 'assistant'
    && typeof message.attribution.item_id === 'string'
    && ['answer', 'rating'].includes(String(message.attribution.phase)))
  const questionFor = (itemId: string) => questionMessages.find((message) => message.attribution.item_id === itemId)
  const mapped = Object.entries(session.answer_map).sort(([left], [right]) =>
    (questionFor(left)?.sequence ?? Infinity) - (questionFor(right)?.sequence ?? Infinity))
  const paragraphs = [
    new Paragraph({ text: survey.label, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: session.progress_label }),
    ...mapped.flatMap(([itemId, sequences]) => [
      new Paragraph({ text: `${itemId} — ${questionFor(itemId)?.content ?? 'Reflection'}`, heading: HeadingLevel.HEADING_1 }),
      ...(session.answer_excerpts?.[itemId] ?? sequences.map((sequence) => bySequence.get(sequence))
        .filter((message) => message?.role === 'student')
        .map((message) => String(message?.attribution.answer_text ?? message?.content ?? '')))
        .map((text) => new Paragraph({
          spacing: { before: 100, after: 100 },
          children: [new TextRun({ text })],
        })),
    ]),
  ]
  const document = new Document({ sections: [{ children: paragraphs }] })
  return Packer.toBlob(document)
}

export function saveStudentDocumentBlob(blob: Blob, label: string, finalized: boolean) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeFilename(label)}-${finalized ? 'final' : 'draft'}.docx`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadStudentDraft(survey: StudentSurvey, session: StudentSession) {
  saveStudentDocumentBlob(await createStudentDraft(survey, session), survey.label, false)
}
