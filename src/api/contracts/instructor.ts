import { z } from 'zod'

const nonEmptyString = z.string().min(1)
const emailSchema = z.string().trim().toLowerCase().email()
const ucscEmailSchema = emailSchema.refine((email) => email.endsWith('@ucsc.edu'), {
  message: 'Profile email must use the ucsc.edu domain',
})
const timestampSchema = z.string().datetime({ offset: true })
const institutionRoleSchema = z.enum(['member', 'admin'])
const courseRoleSchema = z.enum(['owner', 'instructor', 'ta'])
const authProviderSchema = z.enum(['manual', 'cognito'])

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: nonEmptyString,
}).strict()

export const loginResponseSchema = z.object({
  expires_at: timestampSchema,
  must_change_password: z.boolean(),
}).strict()

export const profilePatchRequestSchema = z.object({
  display_name: z.string().trim().min(1).max(100).optional(),
  email: ucscEmailSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Profile patch requires at least one field',
})

export const passwordChangeRequestSchema = z.object({
  current_password: nonEmptyString,
  new_password: nonEmptyString,
}).strict()

export const passwordChangeResponseSchema = loginResponseSchema.extend({
  must_change_password: z.literal(false),
}).strict()

export const institutionMembershipSchema = z.object({
  slug: nonEmptyString,
  name: nonEmptyString,
  role: institutionRoleSchema,
}).strict()

export const courseMembershipSchema = z.object({
  course_id: nonEmptyString,
  course_name: nonEmptyString,
  institution_slug: nonEmptyString.nullable(),
  role: courseRoleSchema,
  can_publish: z.boolean(),
  can_export: z.boolean(),
}).strict()

export const instructorAccountSchema = z.object({
  id: z.number().int().positive(),
  email: emailSchema,
  display_name: nonEmptyString,
  auth_provider: authProviderSchema,
  email_verified: z.boolean(),
  must_change_password: z.boolean(),
  institutions: z.array(institutionMembershipSchema),
  courses: z.array(courseMembershipSchema),
}).strict()

export const courseListItemSchema = courseMembershipSchema.extend({
  instructor_name: nonEmptyString,
}).strict()

export const courseListResponseSchema = z.object({
  courses: z.array(courseListItemSchema),
}).strict()

export const courseCreateRequestSchema = z.object({
  course_id: z.string().trim().toLowerCase().min(1).max(50).regex(/^[a-z0-9-]+$/),
  course_name: z.string().trim().min(1).max(200),
  instructor_name: z.string().trim().min(1).max(100),
  institution_slug: z.string().trim().toLowerCase().min(1),
}).strict()

export const courseCreateResponseSchema = z.object({
  status: z.literal('success'),
  id: z.number().int().positive(),
  course_id: nonEmptyString,
  course_name: nonEmptyString,
  institution_slug: nonEmptyString,
  role: z.literal('owner'),
}).strict()

// Canonical v1 DTOs are separate until legacy instructor routes are removed.
export const canonicalCourseActionSchema = z.enum([
  'course.manage',
  'feedback.author',
  'feedback.publish',
  'responses.view',
  'responses.export',
  'analysis.use',
])

export const canonicalInstructorMeSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  display_name: nonEmptyString,
  must_change_password: z.boolean(),
  platform_role: z.enum(['member', 'platform_admin']),
  institutions: z.array(z.object({
    slug: nonEmptyString,
    name: nonEmptyString,
    can_create_courses: z.boolean(),
  }).strict()),
}).strict()

export const canonicalProfilePatchRequestSchema = z.object({
  display_name: z.string().trim().min(1).max(100),
}).strict()

export const canonicalCourseCreateRequestSchema = z.object({
  institution_slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
  course_code: z.string().regex(/^[a-z0-9-]{1,100}$/),
  course_name: z.string().trim().min(1).max(200),
}).strict()

export const canonicalCourseSchema = z.object({
  course_id: z.string().uuid(),
  course_code: nonEmptyString,
  course_name: nonEmptyString,
  institution_slug: nonEmptyString,
  lifecycle_state: z.literal('active'),
  role: z.enum(['owner', 'instructor', 'ta', 'researcher', 'platform_admin']),
  allowed_actions: z.array(canonicalCourseActionSchema).max(6).refine(
    (actions) => new Set(actions).size === actions.length,
    'Course actions must not repeat',
  ),
}).strict()

export const canonicalCourseListResponseSchema = z.object({
  courses: z.array(canonicalCourseSchema),
}).strict()

export const responseSearchResponseSchema = z.object({
  query: z.string().min(2).max(100),
  results: z.array(z.object({
    message_id: z.number().int().positive(),
    response_id: z.string().uuid(),
    occurrence_label: nonEmptyString,
    excerpt: z.string().max(240),
    created_at: timestampSchema,
  }).strict()).max(20),
  has_more: z.boolean(),
}).strict()

export const courseDebugSettingsSchema = z.object({
  debug_enabled: z.boolean(),
  settings_version: z.number().int().positive(),
}).strict()

export type LoginRequest = z.infer<typeof loginRequestSchema>
export type LoginResponse = z.infer<typeof loginResponseSchema>
export type ProfilePatchRequest = z.infer<typeof profilePatchRequestSchema>
export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>
export type PasswordChangeResponse = z.infer<typeof passwordChangeResponseSchema>
export type InstitutionMembership = z.infer<typeof institutionMembershipSchema>
export type CourseMembership = z.infer<typeof courseMembershipSchema>
export type InstructorAccount = z.infer<typeof instructorAccountSchema>
export type CourseListItem = z.infer<typeof courseListItemSchema>
export type CourseListResponse = z.infer<typeof courseListResponseSchema>
export type CourseDebugSettings = z.infer<typeof courseDebugSettingsSchema>
export type CourseCreateRequest = z.infer<typeof courseCreateRequestSchema>
export type CourseCreateResponse = z.infer<typeof courseCreateResponseSchema>
export type CanonicalInstructorMe = z.infer<typeof canonicalInstructorMeSchema>
export type CanonicalCourse = z.infer<typeof canonicalCourseSchema>
