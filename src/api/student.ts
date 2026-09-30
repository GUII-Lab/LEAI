import { z } from 'zod'
import type { PublicEnvironment } from '@/config/environment'
import { createHttpClient } from './http-client'
import { createSessionClient } from './browser-session'
import { parseJsonResponse } from './contracts/response'
import { ApiFailure } from './contracts/errors'

const uuid = z.string().uuid()
const choiceSchema = z.object({ value: z.number().int().positive(), label: z.string().min(1) }).strict()
const activePromptSchema = z.object({
  item_id: z.string().min(1),
  phase: z.enum(['rating', 'answer', 'reflection', 'probe']),
  text: z.string().min(1),
  wording: z.enum(['exact', 'adaptive']),
  choices: z.array(choiceSchema).nullable(),
  context_note: z.string().optional(),
}).strict()
const completePromptSchema = z.object({ phase: z.literal('complete') }).strict()
export const studentPromptSchema = z.union([activePromptSchema, completePromptSchema])
const itemResultSchema = z.object({
  rating: z.number().int().positive().nullable(),
  status: z.enum(['active', 'answered', 'partial', 'declined', 'unknown', 'not_applicable']),
  probes: z.number().int().nonnegative(),
  targets: z.record(z.string(), z.enum(['covered', 'missing', 'not_applicable'])).optional(),
}).strict()
const messageSchema = z.object({
  id: z.number().int().positive(),
  sequence: z.number().int().positive(),
  role: z.enum(['student', 'assistant', 'system']),
  content: z.string(),
  created_at: z.string().datetime({ offset: true }).optional(),
  attribution: z.record(z.string(), z.unknown()),
}).strict()
export const studentSessionSchema = z.object({
  session_id: uuid,
  survey_id: uuid,
  turn_version: z.number().int().positive(),
  status: z.enum(['active', 'completed', 'closed']),
  prompt: studentPromptSchema,
  progress_label: z.string().min(1),
  results: z.record(z.string(), itemResultSchema),
  answer_map: z.record(z.string(), z.array(z.number().int().positive())).default({}),
  answer_excerpts: z.record(z.string(), z.array(z.string())).optional(),
  messages: z.array(messageSchema),
}).strict()
const debugPhaseSchema = z.enum(['rating', 'answer', 'reflection', 'probe', 'complete', 'revision'])
export const studentDebugSchema = z.object({
  session_id: uuid,
  turn_version: z.number().int().positive(),
  schema_state: z.object({
    item_index: z.number().int().nonnegative(),
    phase: debugPhaseSchema,
    results: z.record(z.string(), itemResultSchema),
    answer_map: z.record(z.string(), z.array(z.number().int().positive())).default({}),
    evidence_seen: z.record(z.string(), z.boolean()),
    coverage_seen: z.record(z.string(), z.array(z.string())),
    orchestration: z.record(z.string(), z.unknown()).optional(),
  }).strict(),
  responses: z.array(z.object({
    sequence: z.number().int().positive(),
    item_id: z.string().min(1).nullable(),
    phase: debugPhaseSchema,
    kind: z.enum(['rating', 'text', 'skip', 'revision', 'clarification']),
    content: z.string(),
    evidence_for: z.array(z.string()),
    covered_targets: z.array(z.string()),
    next_item_id: z.string().min(1).nullable(),
    next_phase: debugPhaseSchema.nullable(),
  }).strict()),
}).strict()
const startedSessionSchema = studentSessionSchema.extend({ token: z.string().min(32) })
const surveySchema = z.object({
  survey_id: uuid,
  is_draft: z.boolean().optional(),
  question_set_revision_id: uuid.nullable().optional(),
  label: z.string().min(1),
  intro: z.string().min(1),
  available: z.boolean(),
  anonymous_matching_enabled: z.boolean(),
  completion_certificate_enabled: z.boolean(),
  completed_response_download_enabled: z.boolean(),
  team_setup_required: z.boolean().optional(),
  team_choices: z.array(z.object({ id: z.string().regex(/^[1-9][0-9]*$/), label: z.string().min(1) }).strict()).optional(),
}).strict()
const debugAccessSchema = z.object({ enabled: z.boolean() }).strict()
const matchingSignalsResponseSchema = z.object({ accepted: z.boolean() }).strict()
const turnSchema = z.discriminatedUnion('kind', [
  z.object({ expected_version: z.number().int().positive(), item_id: z.string().min(1), kind: z.literal('rating'), value: z.number().int().positive() }).strict(),
  z.object({ expected_version: z.number().int().positive(), item_id: z.string().min(1).optional(), kind: z.literal('text'), text: z.string().trim().min(1).max(3000) }).strict(),
  z.object({ expected_version: z.number().int().positive(), item_id: z.string().min(1), kind: z.literal('skip') }).strict(),
])

export type StudentSurvey = z.infer<typeof surveySchema>
export type StudentSession = z.infer<typeof studentSessionSchema>
export type StudentDebug = z.infer<typeof studentDebugSchema>
export type StudentTurn = z.infer<typeof turnSchema>

export function createStudentApi(
  environment: PublicEnvironment,
  canMutate: () => boolean,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
) {
  const publicRequest = createHttpClient(environment, canMutate, fetcher)
  const researcherRequest = createSessionClient(environment, canMutate, fetcher)
  const privateRequest = (token: string) => createHttpClient(environment, canMutate, fetcher, () => token)
  const surveyPath = (surveyId: string) => `surveys/${uuid.parse(surveyId)}/`
  const sessionPath = (surveyId: string, sessionId: string) =>
    `${surveyPath(surveyId)}sessions/${uuid.parse(sessionId)}/`

  return {
    async survey(surveyId: string) {
      return parseJsonResponse(await publicRequest(surveyPath(surveyId)), surveySchema)
    },
    async start(surveyId: string, consent: { terms_consent: true; research_consent: boolean; team_snapshot_item_id?: string }) {
      return parseJsonResponse(await publicRequest(`${surveyPath(surveyId)}sessions/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(consent),
      }), startedSessionSchema)
    },
    async session(surveyId: string, sessionId: string, token: string) {
      return parseJsonResponse(await privateRequest(token)(sessionPath(surveyId, sessionId)), studentSessionSchema)
    },
    async matchingSignals(surveyId: string, sessionId: string, token: string, signals: { device_key: string; fingerprint: string }) {
      const body = z.object({ device_key: z.string().max(128), fingerprint: z.string().max(256) }).strict().parse(signals)
      return parseJsonResponse(await privateRequest(token)(`${sessionPath(surveyId, sessionId)}matching-signals/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }), matchingSignalsResponseSchema)
    },
    async debugAccess(surveyId: string) {
      if (environment.name === 'production') throw new Error('Debug state is unavailable in production')
      return parseJsonResponse(await researcherRequest(`${surveyPath(surveyId)}debug-access/`), debugAccessSchema)
    },
    async debug(surveyId: string, sessionId: string) {
      if (environment.name === 'production') throw new Error('Debug state is unavailable in production')
      return parseJsonResponse(await researcherRequest(`${sessionPath(surveyId, sessionId)}debug/`), studentDebugSchema)
    },
    async turn(surveyId: string, sessionId: string, token: string, turn: StudentTurn) {
      const body = turnSchema.parse(turn)
      return parseJsonResponse(await privateRequest(token)(`${sessionPath(surveyId, sessionId)}turns/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }), studentSessionSchema)
    },
    async finalize(surveyId: string, sessionId: string, token: string, expectedVersion: number) {
      return parseJsonResponse(await privateRequest(token)(`${sessionPath(surveyId, sessionId)}finalize/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_version: expectedVersion }),
      }), studentSessionSchema)
    },
    async responsePdf(surveyId: string, sessionId: string, token: string) {
      const response = await privateRequest(token)(`${sessionPath(surveyId, sessionId)}response.pdf/`)
      if (!response.ok) {
        await parseJsonResponse(response, z.never())
        throw new Error('Unexpected successful error response')
      }
      if (!(response.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/pdf')) {
        throw new ApiFailure({ kind: 'contract', status: response.status, retryable: false })
      }
      return response.blob()
    },
  }
}
