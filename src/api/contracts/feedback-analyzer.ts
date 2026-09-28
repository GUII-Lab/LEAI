import { z } from 'zod'
import { responseSearchResponseSchema } from './instructor'

const id = z.string().uuid()
const nonEmpty = z.string().min(1)
const timestamp = z.string().datetime({ offset: true })
export const analyzerResponseSourceSchema = z.enum(['all', 'chat', 'pdf'])

export type AnalyzerResponseRequest = {
  occurrenceIds: readonly string[]
  cursor?: string
  limit: number
  source: z.infer<typeof analyzerResponseSourceSchema>
  nudgedOnly: boolean
  term?: string
  teamSnapshotItemId?: string
  unlinkedOccurrenceId?: string
}

export const analysisNgramsResponseSchema = z.object({
  source_count: z.number().int().nonnegative(),
  cutoff_at: timestamp.nullable(),
  keyness_available: z.boolean(),
  items: z.array(z.object({
    term: nonEmpty,
    count: z.number().int().positive(),
    keyness: z.number().nullable(),
  }).strict()),
}).strict()

export const analyzerUnavailableSchema = z.object({
  state: z.literal('unavailable'),
  reason: nonEmpty,
}).strict()

export const analyzerMetricSummarySchema = z.object({
  response_count: z.number().int().nonnegative(),
  student_turn_count: z.number().int().nonnegative(),
  pdf_response_count: z.number().int().nonnegative(),
  average_words: z.number().nonnegative().nullable(),
  participation: analyzerUnavailableSchema,
  turn_distribution: z.union([
    z.array(z.object({
      student_turn_count: z.number().int().nonnegative(),
      response_count: z.number().int().positive(),
    }).strict()),
    analyzerUnavailableSchema,
  ]),
  question_health: z.union([
    z.object({
      state: z.literal('available'),
      sections: z.array(z.object({
        section_id: nonEmpty,
        title: nonEmpty,
        response_count: z.number().int().nonnegative(),
        questions: z.array(z.object({
          question_id: nonEmpty,
          prompt: nonEmpty,
          response_count: z.number().int().nonnegative(),
        }).strict()),
      }).strict()),
    }).strict(),
    analyzerUnavailableSchema,
  ]),
}).strict()

export const analysisOverviewResponseSchema = z.object({
  course: z.object({ id, name: nonEmpty }).strict(),
  selected_occurrence_ids: z.array(id),
  occurrences: z.array(z.object({
    id,
    label: nonEmpty,
    mode: z.enum(['general', 'structured', 'team']),
    audience: z.enum(['individual', 'team']),
    collection_style: z.enum(['guided', 'open']),
    completion_certificate_enabled: z.boolean(),
    schema_family_id: id,
    created_at: timestamp,
    metrics: analyzerMetricSummarySchema,
  }).strict()),
  summary: analyzerMetricSummarySchema,
  team_surveys: z.array(z.object({
    id,
    label: nonEmpty,
    configuration_label: nonEmpty,
    teams: z.array(z.object({
      id: nonEmpty,
      label: nonEmpty,
      response_count: z.number().int().nonnegative(),
    }).strict()),
    unlinked_response_count: z.number().int().nonnegative(),
  }).strict()),
}).strict()

export const analysisResponseSchema = z.object({
  kind: z.enum(['chat', 'pdf']),
  response_id: id,
  label: nonEmpty,
  survey_label: nonEmpty,
  created_at: timestamp,
  nudged: z.boolean(),
  response_href: nonEmpty,
  transcript: z.array(z.object({
    message_id: nonEmpty,
    content: z.string(),
    timestamp,
  }).strict()),
  answers: z.array(z.object({
    answer_id: nonEmpty,
    question: nonEmpty,
    value: z.string(),
  }).strict()),
  occurrence_id: id,
  team_snapshot_id: nonEmpty.nullable(),
  team_snapshot_item_id: nonEmpty.nullable(),
  team_label: z.string().nullable(),
  team_configuration_label: z.string().nullable(),
  source: z.enum(['student', 'pdf']),
}).strict()

export const analysisResponsesResponseSchema = z.object({
  results: z.array(analysisResponseSchema),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
}).strict()

const progressOccurrenceSchema = z.object({ id, label: nonEmpty }).strict()
const progressCountsSchema = z.record(id, z.number().int().nonnegative())

export const analysisProgressResponseSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('unavailable'),
    reason: z.literal('matching_disabled'),
    occurrences: z.array(progressOccurrenceSchema),
    students: z.array(z.never()),
    groups: z.array(z.never()),
    unlinked_by_occurrence: z.array(z.never()),
  }).strict(),
  z.object({
    state: z.literal('available'),
    occurrences: z.array(progressOccurrenceSchema),
    students: z.array(z.object({
      label: z.string().regex(/^S[1-9][0-9]*$/),
      match_confidence: z.enum(['high', 'moderate', 'low', 'unlinked']),
      responses_by_occurrence: progressCountsSchema,
    }).strict()),
    groups: z.array(z.object({
      label: z.string().regex(/^G[1-9][0-9]*$/),
      team_snapshot_id: nonEmpty,
      team_snapshot_label: nonEmpty,
      responses_by_occurrence: progressCountsSchema,
    }).strict()),
    unlinked_by_occurrence: z.array(z.object({
      occurrence_id: id,
      response_count: z.number().int().nonnegative(),
    }).strict()),
  }).strict(),
])

export const analysisSettingsResponseSchema = z.object({
  anonymous_matching_enabled: z.boolean(),
  settings_version: z.number().int().positive(),
}).strict()

export const analysisSettingsRequestSchema = z.object({
  anonymous_matching_enabled: z.boolean(),
  expected_settings_version: z.number().int().positive(),
}).strict()

export const certificateVerificationRequestSchema = z.object({
  occurrence_id: id,
  codes: z.array(z.string().max(64)).min(1).max(100),
}).strict()

export const certificateVerificationResponseSchema = z.object({
  results: z.array(z.boolean()).max(100),
}).strict()

export type AnalysisMetricSummary = z.infer<typeof analyzerMetricSummarySchema>
export type AnalysisOverviewResponse = z.infer<typeof analysisOverviewResponseSchema>
export type AnalysisNgramsResponse = z.infer<typeof analysisNgramsResponseSchema>
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>
export type AnalysisResponsesResponse = z.infer<typeof analysisResponsesResponseSchema>
export type AnalysisSearchResponse = z.infer<typeof responseSearchResponseSchema>
export type AnalysisProgressResponse = z.infer<typeof analysisProgressResponseSchema>
export type AnalysisSettingsResponse = z.infer<typeof analysisSettingsResponseSchema>
export type AnalysisSettingsRequest = z.infer<typeof analysisSettingsRequestSchema>
export type CertificateVerificationRequest = z.infer<typeof certificateVerificationRequestSchema>
export type CertificateVerificationResponse = z.infer<typeof certificateVerificationResponseSchema>
