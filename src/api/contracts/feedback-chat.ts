import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)
const timestamp = z.string().datetime({ offset: true })
const uuid = z.string().uuid()

export const feedbackChatOccurrenceSchema = z.object({
  id: uuid,
  label: nonEmpty.max(200),
  revision: z.number().int().positive(),
}).strict()
export const feedbackChatOccurrenceListSchema = z.object({ occurrences: z.array(feedbackChatOccurrenceSchema).max(200) }).strict()

export const feedbackChatCitationSchema = z.object({
  id: z.string().regex(/^\d+$/),
  citation_number: z.number().int().positive(),
  claim_key: nonEmpty.max(128),
  response_id: uuid,
  response_message_id: z.number().int().positive().nullable(),
  occurrence_id: uuid,
  week_label: z.string().max(200).nullable(),
  survey_label: z.string().max(200).nullable(),
  question_label: z.string().max(300).nullable(),
  evidence_quote: nonEmpty.max(1000),
}).strict()

export const feedbackChatMessageSchema = z.object({
  id: z.string().regex(/^\d+$/),
  sequence: z.number().int().positive(),
  role: z.enum(['user', 'assistant']),
  content: nonEmpty.max(3000),
  created_at: timestamp,
  citations: z.array(feedbackChatCitationSchema).max(20),
}).strict()

export const feedbackChatSummarySchema = z.object({
  id: uuid,
  title: nonEmpty.max(120),
  updated_at: timestamp,
}).strict()
export const feedbackChatListSchema = z.object({ chats: z.array(feedbackChatSummarySchema).max(200) }).strict()

export const feedbackChatDetailSchema = z.object({
  id: uuid,
  title: nonEmpty.max(120),
  prompt_override: z.string().max(4000).nullable(),
  archived: z.boolean(),
  updated_at: timestamp,
  sources: z.array(feedbackChatOccurrenceSchema).max(200),
  messages: z.array(feedbackChatMessageSchema).max(2000),
}).strict()

export const feedbackChatJobSchema = z.object({
  id: uuid,
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  error_code: z.string().max(64).nullable(),
  result: z.object({ assistant_message_id: z.string().regex(/^\d+$/) }).strict().nullable(),
}).strict()
export const feedbackChatTurnResponseSchema = z.object({ job_id: uuid }).strict()

export const createFeedbackChatRequestSchema = z.object({ title: z.string().trim().min(1).max(120).optional() }).strict()
export const updateFeedbackChatRequestSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  prompt_override: z.string().max(4000).nullable().optional(),
}).strict().refine((body) => Object.keys(body).length > 0)
export const addFeedbackChatScopeRequestSchema = z.object({ occurrence_ids: z.array(uuid).min(1).max(20) }).strict()
export const createFeedbackChatTurnRequestSchema = z.object({
  content: z.string().trim().min(1).max(3000),
  retry_message_id: z.string().regex(/^[1-9][0-9]{0,19}$/).optional(),
}).strict()

export type FeedbackChatOccurrence = z.infer<typeof feedbackChatOccurrenceSchema>
export type FeedbackChatCitation = z.infer<typeof feedbackChatCitationSchema>
export type FeedbackChatMessage = z.infer<typeof feedbackChatMessageSchema>
export type FeedbackChatSummary = z.infer<typeof feedbackChatSummarySchema>
export type FeedbackChatDetail = z.infer<typeof feedbackChatDetailSchema>
export type FeedbackChatJob = z.infer<typeof feedbackChatJobSchema>
export type FeedbackChatTurnResponse = z.infer<typeof feedbackChatTurnResponseSchema>
