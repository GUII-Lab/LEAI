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
  token: nonEmptyString,
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

export const passwordChangeResponseSchema = z.object({
  status: z.literal('password_changed'),
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
export type CourseCreateRequest = z.infer<typeof courseCreateRequestSchema>
export type CourseCreateResponse = z.infer<typeof courseCreateResponseSchema>
