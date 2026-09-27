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

async function parseResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) throw new AuthenticationRequiredError()
    const payload: unknown = await response.json().catch(() => null)
    const error = z.object({ error: z.string() }).safeParse(payload)
    throw new InstructorApiError(response.status, error.success ? error.data.error : 'request_failed')
  }
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
    async logout() {
      const response = await protectedRequest('instructor_sessions/', { method: 'DELETE' })
      if (response.status === 401) throw new AuthenticationRequiredError()
      if (!response.ok) throw new InstructorApiError(response.status, 'request_failed')
    },
  }
}
