import { z } from 'zod'

const id = z.string().uuid()
const date = z.string().datetime({ offset: true })

const item = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  wording: z.enum(['exact', 'adaptive']),
  response: z.object({ kind: z.literal('text') }).strict(),
  reflection_goal: z.string().min(1),
  coverage_targets: z.array(z.object({ id: z.string(), description: z.string() }).strict()),
  example_probes: z.array(z.string()),
  max_additional_probes: z.number().int().min(0).max(5),
}).strict()

export const protocolSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(200),
  intro: z.string().min(1),
  scales: z.record(z.string(), z.array(z.object({ value: z.number().int(), label: z.string() }).strict())),
  sections: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    items: z.array(item).min(1),
  }).strict()).min(1),
}).strict()

export const wizardDraftSchema = z.object({
  id,
  title: z.string().min(1),
  audience: z.enum(['individual', 'team']),
  collection_style: z.enum(['guided', 'open']),
  draft_version: z.number().int().positive(),
  body: protocolSchema,
  updated_at: date,
  resumable: z.boolean(),
}).strict()

export const wizardDraftListSchema = z.object({ question_sets: z.array(wizardDraftSchema) }).strict()
export const wizardSaveResponseSchema = wizardDraftSchema.extend({ changed: z.boolean() }).strict()

export const wizardTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  audience: z.enum(['individual', 'team']),
  collection_style: z.enum(['guided', 'open']),
  source: z.enum(['leai', 'my', 'community']),
}).strict()
export const wizardTemplateListSchema = z.object({ templates: z.array(wizardTemplateSchema) }).strict()
export const wizardTemplateSaveRequestSchema = z.object({
  revision_id: id,
  title: z.string().trim().min(1).max(200),
}).strict()
export const wizardTemplateSaveResponseSchema = wizardTemplateSchema

export const wizardVersionSchema = z.object({
  id: z.string().regex(/^[1-9][0-9]*$/),
  number: z.number().int().positive(),
  body: protocolSchema,
  change_kind: z.enum(['manual', 'ai', 'restore', 'delete']),
  created_at: date,
}).strict()
export const wizardVersionListSchema = z.object({ versions: z.array(wizardVersionSchema) }).strict()

export const wizardRevisionSchema = z.object({
  id,
  question_set_id: id,
  revision_number: z.number().int().positive(),
  source_draft_version: z.number().int().positive(),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  body: protocolSchema,
  preview_decision: z.enum(['completed', 'skipped']).nullable(),
  created_at: date,
}).strict()
export const wizardFreezeResponseSchema = z.object({ revision: wizardRevisionSchema }).strict()

export const wizardPreviewMessageSchema = z.object({
  id: z.string().regex(/^[1-9][0-9]*$/),
  role: z.enum(['student', 'assistant', 'system']),
  content: z.string(),
  item_id: z.string().nullable(),
  created_at: date,
}).strict()
export const wizardPreviewSchema = z.object({
  preview_id: id,
  revision: wizardRevisionSchema,
  messages: z.array(wizardPreviewMessageSchema),
}).strict()
export const wizardPreviewTurnSchema = z.object({
  id: z.string().regex(/^[1-9][0-9]*$/),
  answered_count: z.number().int().nonnegative(),
}).strict()

export const wizardSurveySchema = z.object({
  id,
  question_set_id: id,
  revision_id: id,
  label: z.string().min(1),
  audience: z.enum(['individual', 'team']),
  collection_style: z.enum(['guided', 'open']),
  state: z.enum(['open', 'scheduled', 'closed']),
  direct_url: z.string().startsWith('feedback.html?id='),
  opens_at: date.nullable(),
  closes_at: date.nullable(),
  team_setup_required: z.boolean(),
  completion_certificate_enabled: z.boolean().default(false),
  completed_response_download_enabled: z.boolean().default(false),
  allowed_actions: z.array(z.enum(['copy_link', 'create_revised_version'])),
}).strict()
export const wizardSurveyListSchema = z.object({ surveys: z.array(wizardSurveySchema) }).strict()

export const wizardConversationMessageSchema = z.object({
  id: z.string().regex(/^[1-9][0-9]*$/),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  created_at: date,
}).strict()
export const wizardConversationSchema = z.object({
  messages: z.array(wizardConversationMessageSchema),
}).strict()
export const wizardJobStartSchema = z.object({ job_id: id }).strict()

export type WizardProtocol = z.infer<typeof protocolSchema>
export type WizardDraft = z.infer<typeof wizardDraftSchema>
export type WizardTemplate = z.infer<typeof wizardTemplateSchema>
export type WizardVersion = z.infer<typeof wizardVersionSchema>
export type WizardRevision = z.infer<typeof wizardRevisionSchema>
export type WizardPreview = z.infer<typeof wizardPreviewSchema>
export type WizardSurvey = z.infer<typeof wizardSurveySchema>
export type WizardConversationMessage = z.infer<typeof wizardConversationMessageSchema>
