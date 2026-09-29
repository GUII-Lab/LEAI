import { describe, expect, it } from 'vitest'
import {
  feedbackChatDetailSchema,
  feedbackChatJobSchema,
  feedbackChatListSchema,
  feedbackChatOccurrenceListSchema,
  feedbackChatTurnResponseSchema,
  createFeedbackChatTurnRequestSchema,
} from './feedback-chat'

const id = '550e8400-e29b-41d4-a716-446655440000'
const detail = {
  id,
  title: 'Week 2 feedback',
  prompt_override: null,
  archived: false,
  updated_at: '2026-09-27T12:30:45Z',
  sources: [{ id: '550e8400-e29b-41d4-a716-446655440001', label: 'Week 2 reflection', revision: 1 }],
  messages: [{ id: '12', sequence: 1, role: 'assistant', content: 'Consider making the instructions clearer.', created_at: '2026-09-27T12:30:45Z', citations: [{ id: '9', citation_number: 1, claim_key: 'clarity', response_id: '550e8400-e29b-41d4-a716-446655440002', response_message_id: 21, occurrence_id: '550e8400-e29b-41d4-a716-446655440001', week_label: 'Week 2', survey_label: 'Reflection', question_label: null, evidence_quote: 'The instructions were confusing.' }] }],
}

describe('Feedback Chat DTOs', () => {
  it('parses canonical occurrence lists, session detail, and redacted jobs', () => {
    expect(feedbackChatOccurrenceListSchema.parse({ occurrences: [{ id: detail.sources[0].id, label: 'Week 2 reflection', revision: 1 }] }).occurrences).toHaveLength(1)
    expect(feedbackChatDetailSchema.parse(detail).messages[0].citations[0].evidence_quote).toBe('The instructions were confusing.')
    expect(feedbackChatListSchema.parse({ chats: [{ id, title: 'Week 2 feedback', updated_at: detail.updated_at }] }).chats).toHaveLength(1)
    expect(feedbackChatJobSchema.parse({ id, status: 'pending', error_code: null, result: null }).status).toBe('pending')
    expect(feedbackChatJobSchema.parse({ id, status: 'cancelled', error_code: 'admin_cancelled', result: null }).status).toBe('cancelled')
    expect(feedbackChatTurnResponseSchema.parse({ job_id: id }).job_id).toBe(id)
    expect(createFeedbackChatTurnRequestSchema.parse({ content: 'Repeat this turn', retry_message_id: '12' }).retry_message_id).toBe('12')
  })

  it('rejects unknown keys, invalid roles, and job diagnostics containing payloads', () => {
    expect(feedbackChatDetailSchema.safeParse({ ...detail, api_key: 'secret' }).success).toBe(false)
    expect(feedbackChatDetailSchema.safeParse({ ...detail, messages: [{ ...detail.messages[0], role: 'system' }] }).success).toBe(false)
    expect(feedbackChatJobSchema.safeParse({ id, status: 'pending', error_code: null, result: null, payload: { transcript: 'private' } }).success).toBe(false)
    expect(createFeedbackChatTurnRequestSchema.safeParse({ content: 'Repeat', retry_message_id: '0' }).success).toBe(false)
  })

  it('accepts legacy session-level citations that do not identify one message', () => {
    const legacyCitation = { ...detail.messages[0].citations[0], response_message_id: null }
    expect(feedbackChatDetailSchema.parse({
      ...detail,
      messages: [{ ...detail.messages[0], citations: [legacyCitation] }],
    }).messages[0].citations[0].response_message_id).toBeNull()
  })
})
