import { z } from 'zod'

const uuidSchema = z.string().uuid()
const timestampSchema = z.string().datetime({ offset: true })
const nonEmptyString = z.string().min(1)
const positiveVersionSchema = z.number().int().positive()
const idempotencyKeySchema = z.string().min(8).max(100)
const checkpointReasonSchema = z.enum(['ai', 'preview', 'publish', 'leave', 'restore'])
const sourceKindSchema = z.enum(['template', 'blank', 'copied_revision', 'legacy'])

const activeDraftShape = {
  id: uuidSchema,
  question_set_id: uuidSchema,
  course_id: nonEmptyString,
  template_id: z.string(),
  title: nonEmptyString,
  source_kind: sourceKindSchema,
  source_template_revision_id: uuidSchema.nullable(),
  workflow_status: z.literal('active'),
  body: z.unknown(),
  version: positiveVersionSchema,
  base_revision_id: uuidSchema.nullable(),
  current_checkpoint_id: uuidSchema.nullable(),
  updated_at: timestampSchema,
} as const

const individualDraftSchema = z.object({
  ...activeDraftShape,
  audience: z.literal('individual'),
  collection_style: z.enum(['guided', 'open']),
}).strict()

const teamDraftSchema = z.object({
  ...activeDraftShape,
  audience: z.literal('team'),
  collection_style: z.literal('guided'),
}).strict()

export const activeDraftSchema = z.discriminatedUnion('audience', [
  individualDraftSchema,
  teamDraftSchema,
])

export const activeDraftListSchema = z.object({
  drafts: z.array(activeDraftSchema),
}).strict()

export const draftSaveRequestSchema = z.object({
  expected_version: positiveVersionSchema,
  body: z.unknown(),
  idempotency_key: idempotencyKeySchema,
  checkpoint_reason: checkpointReasonSchema.nullable().optional(),
}).strict().refine((value) => Object.hasOwn(value, 'body'), {
  message: 'Draft save requires body',
})

export const draftRestoreRequestSchema = z.object({
  expected_version: positiveVersionSchema,
  version_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
}).strict()

export const freezeDraftRequestSchema = z.object({
  expected_version: positiveVersionSchema,
}).strict()

export const immutableRevisionSchema = z.object({
  id: uuidSchema,
  question_set_id: uuidSchema,
  revision_number: positiveVersionSchema,
  source_draft_version: positiveVersionSchema,
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  compiler_version: nonEmptyString,
  engine_version: nonEmptyString,
  preview_completed: z.boolean(),
  created_at: timestampSchema,
}).strict()

export const freezeDraftResponseSchema = z.object({
  revision: immutableRevisionSchema,
}).strict()

export const previewSettingsSchema = z.object({
  completion_certificate_enabled: z.boolean(),
  parsed_document_download_enabled: z.boolean(),
}).strict()

export const previewSettingsPatchSchema = z.object({
  completion_certificate_enabled: z.boolean().optional(),
  parsed_document_download_enabled: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Preview settings patch requires at least one field',
})

export const previewStatusSchema = z.object({
  preview_completed: z.boolean(),
  preview_skipped: z.boolean(),
}).strict()

export const previewCapabilitySchema = z.object({
  token: nonEmptyString,
  expires_at: timestampSchema,
  ready_at: timestampSchema,
  preview_url: z.string().startsWith('feedback.html?preview='),
  completion_certificate_enabled: z.boolean(),
  parsed_document_download_enabled: z.boolean(),
  preview_completed: z.boolean(),
  preview_skipped: z.boolean(),
}).strict().refine((value) => Date.parse(value.ready_at) < Date.parse(value.expires_at), {
  path: ['ready_at'],
  message: 'Preview ready time must be before expiry',
})

export const previewCompleteResponseSchema = z.object({
  completed: z.literal(true),
  completed_at: timestampSchema,
  question_set_revision_id: uuidSchema,
}).strict()

export const individualPublicationRequestSchema = z.object({
  course_id: nonEmptyString,
  idempotency_key: idempotencyKeySchema,
  survey_label: z.string().trim().min(1).max(200).nullable().optional(),
  week_number: z.number().int().min(1).max(99).nullable().optional(),
  opens_at: timestampSchema.nullable().optional(),
  expires_at: timestampSchema.nullable().optional(),
  preview_token: nonEmptyString,
}).strict().superRefine((value, context) => {
  if (
    value.opens_at &&
    value.expires_at &&
    Date.parse(value.opens_at) >= Date.parse(value.expires_at)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['expires_at'],
      message: 'Closing time must be after opening time',
    })
  }
})

export const individualPublicationResponseSchema = z.object({
  id: z.number().int().positive(),
  public_id: z.string().min(1).max(16),
  name: nonEmptyString,
  survey_label: nonEmptyString,
  mode: z.enum(['form', 'general']),
  question_set_revision_id: uuidSchema,
  direct_url: z.string().startsWith('feedback.html?id='),
  opens_at: timestampSchema.nullable(),
  expires_at: timestampSchema.nullable(),
  completion_certificate_enabled: z.boolean(),
  parsed_document_download_enabled: z.boolean(),
  team_configuration_id: z.null(),
}).strict()

export type ActiveDraft = z.infer<typeof activeDraftSchema>
export type ActiveDraftList = z.infer<typeof activeDraftListSchema>
export type DraftSaveRequest = z.infer<typeof draftSaveRequestSchema>
export type DraftRestoreRequest = z.infer<typeof draftRestoreRequestSchema>
export type FreezeDraftRequest = z.infer<typeof freezeDraftRequestSchema>
export type ImmutableRevision = z.infer<typeof immutableRevisionSchema>
export type FreezeDraftResponse = z.infer<typeof freezeDraftResponseSchema>
export type PreviewSettings = z.infer<typeof previewSettingsSchema>
export type PreviewSettingsPatch = z.infer<typeof previewSettingsPatchSchema>
export type PreviewStatus = z.infer<typeof previewStatusSchema>
export type PreviewCapability = z.infer<typeof previewCapabilitySchema>
export type PreviewCompleteResponse = z.infer<typeof previewCompleteResponseSchema>
export type IndividualPublicationRequest = z.infer<typeof individualPublicationRequestSchema>
export type IndividualPublicationResponse = z.infer<typeof individualPublicationResponseSchema>
