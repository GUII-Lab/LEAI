import { z } from 'zod'
import type { PublicEnvironment } from '@/config/environment'
import { createSessionClient } from './browser-session'
import {
  canonicalCourseListResponseSchema,
  canonicalCourseCreateRequestSchema,
  canonicalCourseSchema,
  canonicalInstructorMeSchema,
  canonicalProfilePatchRequestSchema,
  courseDebugSettingsSchema,
  loginRequestSchema,
  loginResponseSchema,
  passwordChangeRequestSchema,
  passwordChangeResponseSchema,
  responseSearchResponseSchema,
} from './contracts/instructor'
import {
  addFeedbackChatScopeRequestSchema,
  createFeedbackChatRequestSchema,
  createFeedbackChatTurnRequestSchema,
  feedbackChatDetailSchema,
  feedbackChatJobSchema,
  feedbackChatListSchema,
  feedbackChatOccurrenceListSchema,
  feedbackChatTurnResponseSchema,
  updateFeedbackChatRequestSchema,
} from './contracts/feedback-chat'
import {
  analysisNgramsResponseSchema,
  analysisOverviewResponseSchema,
  analysisProgressResponseSchema,
  analysisResponseSchema,
  analysisResponsesResponseSchema,
  analysisSettingsRequestSchema,
  analysisSettingsResponseSchema,
  certificateVerificationRequestSchema,
  certificateVerificationResponseSchema,
} from './contracts/feedback-analyzer'
import type { AnalyzerResponseRequest, CertificateVerificationRequest } from './contracts/feedback-analyzer'

export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Your session has ended. Sign in again.')
  }
}

export class InstructorApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

async function ensureResponseOk(response: Response): Promise<void> {
  if (!response.ok) {
    if (response.status === 401) throw new AuthenticationRequiredError()
    const payload: unknown = await response.json().catch(() => null)
    const error = z.object({ error: z.string() }).safeParse(payload)
    throw new InstructorApiError(response.status, error.success ? error.data.error : 'request_failed')
  }
}

async function parseResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  await ensureResponseOk(response)
  return schema.parse(await response.json())
}

export function createInstructorApi(
  environment: PublicEnvironment,
  canMutate: () => boolean,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
) {
  const protectedRequest = createSessionClient(environment, canMutate, fetcher)

  return {
    async login(email: string, password: string) {
      const body = loginRequestSchema.parse({ email, password })
      return parseResponse(
        await protectedRequest('instructor_sessions/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        loginResponseSchema,
      )
    },
    async me(signal?: AbortSignal) {
      return parseResponse(await protectedRequest('instructor_me/', { signal }), canonicalInstructorMeSchema)
    },
    async updateProfile(displayName: string) {
      const body = canonicalProfilePatchRequestSchema.parse({ display_name: displayName })
      return parseResponse(
        await protectedRequest('instructor_me/', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        canonicalInstructorMeSchema,
      )
    },
    async changePassword(currentPassword: string, newPassword: string) {
      const body = passwordChangeRequestSchema.parse({
        current_password: currentPassword,
        new_password: newPassword,
      })
      return parseResponse(
        await protectedRequest('instructor_password/', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        passwordChangeResponseSchema,
      )
    },
    async courses(signal?: AbortSignal) {
      return parseResponse(
        await protectedRequest('instructor_courses/', { signal }),
        canonicalCourseListResponseSchema,
      )
    },
    async createCourse(input: { institution_slug: string; course_code: string; course_name: string }) {
      const body = canonicalCourseCreateRequestSchema.parse(input)
      return parseResponse(
        await protectedRequest('instructor_courses/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        canonicalCourseSchema,
      )
    },
    async debugSettings(courseId: string, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/debug-settings/`, { signal }),
        courseDebugSettingsSchema,
      )
    },
    async updateDebugSettings(courseId: string, enabled: boolean, expectedSettingsVersion: number) {
      const id = z.string().uuid().parse(courseId)
      const body = z.object({
        debug_enabled: z.boolean(),
        expected_settings_version: z.number().int().positive(),
      }).strict().parse({ debug_enabled: enabled, expected_settings_version: expectedSettingsVersion })
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/debug-settings/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        courseDebugSettingsSchema,
      )
    },
    async search(courseId: string, query: string, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      const q = z.string().trim().min(2).max(100).parse(query)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/responses/search/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
          signal,
        }),
        responseSearchResponseSchema,
      )
    },
    async occurrences(courseId: string, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/occurrences/`, { signal }),
        feedbackChatOccurrenceListSchema,
      )
    },
    async chats(courseId: string, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/chats/`, { signal }),
        feedbackChatListSchema,
      )
    },
    async createChat(courseId: string, input: { title?: string }) {
      const id = z.string().uuid().parse(courseId)
      const body = createFeedbackChatRequestSchema.parse(input)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/chats/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        feedbackChatDetailSchema,
      )
    },
    async chat(courseId: string, chatId: string, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      const chat = z.string().uuid().parse(chatId)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/chats/${chat}/`, { signal }),
        feedbackChatDetailSchema,
      )
    },
    async renameChat(courseId: string, chatId: string, input: { title?: string; prompt_override?: string | null }) {
      const id = z.string().uuid().parse(courseId)
      const chat = z.string().uuid().parse(chatId)
      const body = updateFeedbackChatRequestSchema.parse(input)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/chats/${chat}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        feedbackChatDetailSchema,
      )
    },
    async archiveChat(courseId: string, chatId: string) {
      const id = z.string().uuid().parse(courseId)
      const chat = z.string().uuid().parse(chatId)
      await ensureResponseOk(await protectedRequest(`instructor_courses/${id}/analysis/chats/${chat}/`, { method: 'DELETE' }))
    },
    async addChatScope(courseId: string, chatId: string, input: { occurrence_ids: string[] }) {
      const id = z.string().uuid().parse(courseId)
      const chat = z.string().uuid().parse(chatId)
      const body = addFeedbackChatScopeRequestSchema.parse(input)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/chats/${chat}/scope/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        feedbackChatDetailSchema,
      )
    },
    async createTurn(courseId: string, chatId: string, input: { content: string; retry_message_id?: string }, idempotencyKey: string) {
      const id = z.string().uuid().parse(courseId)
      const chat = z.string().uuid().parse(chatId)
      const body = createFeedbackChatTurnRequestSchema.parse(input)
      const key = z.string().min(1).max(1024).parse(idempotencyKey)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/chats/${chat}/turns/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify(body),
        }),
        feedbackChatTurnResponseSchema,
      )
    },
    async job(courseId: string, jobId: string, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      const job = z.string().uuid().parse(jobId)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/jobs/${job}/`, { signal }),
        feedbackChatJobSchema,
      )
    },
    async overview(courseId: string, occurrenceIds: readonly string[] | undefined, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      const params = new URLSearchParams()
      if (occurrenceIds !== undefined) {
        params.set('occurrence_ids', occurrenceIds.map((value) => z.string().uuid().parse(value)).join(','))
      }
      const queryString = params.toString()
      const query = queryString ? `?${queryString}` : ''
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/overview/${query}`, { signal }),
        analysisOverviewResponseSchema,
      )
    },
    async ngrams(courseId: string, occurrenceIds: readonly string[] | undefined, size: 1 | 2 | 3, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      const params = new URLSearchParams({ size: String(z.union([z.literal(1), z.literal(2), z.literal(3)]).parse(size)) })
      if (occurrenceIds !== undefined) {
        params.set('occurrence_ids', occurrenceIds.map((value) => z.string().uuid().parse(value)).join(','))
      }
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/ngrams/?${params.toString()}`, { signal }),
        analysisNgramsResponseSchema,
      )
    },
    async responses(courseId: string, request: AnalyzerResponseRequest, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      const params = new URLSearchParams({
        occurrence_ids: request.occurrenceIds.map((value) => z.string().uuid().parse(value)).join(','),
        limit: String(request.limit),
        source: request.source,
        nudged_only: String(request.nudgedOnly),
      })
      if (request.cursor) params.set('cursor', request.cursor)
      if (request.term) params.set('term', z.string().trim().min(2).max(100).parse(request.term))
      if (request.teamSnapshotItemId) params.set('team_snapshot_item_id', request.teamSnapshotItemId)
      if (request.unlinkedOccurrenceId) params.set('unlinked_occurrence_id', z.string().uuid().parse(request.unlinkedOccurrenceId))
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/responses/?${params.toString()}`, { signal }),
        analysisResponsesResponseSchema,
      )
    },
    async responseDetail(courseId: string, responseId: string, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      const response = z.string().uuid().parse(responseId)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/responses/${response}/`, { signal }),
        analysisResponseSchema,
      )
    },
    async verifyCertificates(courseId: string, input: CertificateVerificationRequest) {
      const id = z.string().uuid().parse(courseId)
      const body = certificateVerificationRequestSchema.parse(input)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/certificates/verify/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        certificateVerificationResponseSchema,
      )
    },
    async progress(courseId: string, occurrenceIds: readonly string[], signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      const params = new URLSearchParams({
        occurrence_ids: occurrenceIds.map((value) => z.string().uuid().parse(value)).join(','),
      })
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis/progress/?${params.toString()}`, { signal }),
        analysisProgressResponseSchema,
      )
    },
    async settings(courseId: string, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis-settings/`, { signal }),
        analysisSettingsResponseSchema,
      )
    },
    async updateSettings(courseId: string, input: { anonymous_matching_enabled: boolean; expected_settings_version: number }, signal?: AbortSignal) {
      const id = z.string().uuid().parse(courseId)
      const body = analysisSettingsRequestSchema.parse(input)
      return parseResponse(
        await protectedRequest(`instructor_courses/${id}/analysis-settings/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        }),
        analysisSettingsResponseSchema,
      )
    },
    async logout() {
      const response = await protectedRequest('instructor_sessions/', { method: 'DELETE' })
      if (response.status === 401) throw new AuthenticationRequiredError()
      if (!response.ok) throw new InstructorApiError(response.status, 'request_failed')
    },
  }
}
