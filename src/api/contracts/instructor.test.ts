import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  courseCreateRequestSchema,
  courseCreateResponseSchema,
  courseListResponseSchema,
  instructorAccountSchema,
  loginRequestSchema,
  loginResponseSchema,
  passwordChangeRequestSchema,
  passwordChangeResponseSchema,
  profilePatchRequestSchema,
  type InstructorAccount,
  type LoginResponse,
  canonicalInstructorMeSchema,
  canonicalCourseListResponseSchema,
  responseSearchResponseSchema,
} from './instructor'

const accountFixture = {
  id: 7,
  email: 'teacher@ucsc.edu',
  display_name: 'Prof. Test',
  auth_provider: 'manual',
  email_verified: false,
  must_change_password: true,
  institutions: [{ slug: 'ucsc', name: 'UC Santa Cruz', role: 'member' }],
  courses: [{
    course_id: 'cmpm-80h',
    course_name: 'Game Design',
    institution_slug: 'ucsc',
    role: 'owner',
    can_publish: false,
    can_export: true,
  }],
} as const

describe('instructor contracts', () => {
  it('parses the canonical course list and bounded search results without legacy flags', () => {
    const course = {
      course_id: '11111111-1111-4111-8111-111111111111',
      course_code: 'winter',
      course_name: 'Winter Game Design',
      institution_slug: 'ucsc',
      lifecycle_state: 'active',
      role: 'instructor',
      allowed_actions: ['course.manage', 'feedback.author', 'feedback.publish', 'responses.view', 'responses.export', 'analysis.use'],
    }
    expect(canonicalCourseListResponseSchema.parse({ courses: [course] }).courses[0].allowed_actions)
      .toContain('responses.view')
    expect(canonicalCourseListResponseSchema.safeParse({ courses: [{ ...course, can_export: true }] }).success)
      .toBe(false)
    expect(canonicalCourseListResponseSchema.safeParse({ courses: [{ ...course, allowed_actions: ['unknown'] }] }).success)
      .toBe(false)
    expect(canonicalInstructorMeSchema.parse({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'teacher@ucsc.edu',
      display_name: 'Teacher',
      must_change_password: false,
      platform_role: 'member',
      institutions: [],
    }).email).toBe('teacher@ucsc.edu')
    expect(responseSearchResponseSchema.parse({
      query: 'capstone',
      has_more: false,
      results: [{
        message_id: 1,
        response_id: '33333333-3333-4333-8333-333333333333',
        occurrence_label: 'Midterm reflection',
        excerpt: 'My capstone prototype improved.',
        created_at: '2026-09-22T12:30:45+00:00',
      }],
    }).results).toHaveLength(1)
  })
  it('preserves the evidenced login response and inferred output type', () => {
    const result = loginResponseSchema.parse({
      expires_at: '2026-09-22T12:30:45.123456+00:00',
      must_change_password: true,
    })

    expect(result).toEqual({
      expires_at: '2026-09-22T12:30:45.123456+00:00',
      must_change_password: true,
    })
    expectTypeOf(result).toEqualTypeOf<LoginResponse>()
  })

  it('parses current account memberships without inventing role capabilities', () => {
    const result = instructorAccountSchema.parse(accountFixture)

    expect(result.courses[0]).toMatchObject({
      role: 'owner',
      can_publish: false,
      can_export: true,
    })
    expectTypeOf(result).toEqualTypeOf<InstructorAccount>()
  })

  it('preserves nullable institution slugs in current account and course-list rows', () => {
    const account = instructorAccountSchema.parse({
      ...accountFixture,
      courses: [{ ...accountFixture.courses[0], institution_slug: null }],
    })
    const list = courseListResponseSchema.parse({
      courses: [{
        ...accountFixture.courses[0],
        instructor_name: 'Prof. Test',
        institution_slug: null,
      }],
    })

    expect(account.courses[0].institution_slug).toBeNull()
    expect(list.courses[0].institution_slug).toBeNull()
  })

  it.each([
    { ...accountFixture, id: undefined },
    { ...accountFixture, email: undefined },
    { ...accountFixture, institutions: [{ slug: 'ucsc', name: 'UCSC', role: 'owner' }] },
    { ...accountFixture, courses: [{ ...accountFixture.courses[0], role: 'admin' }] },
    { ...accountFixture, capabilities: { can_manage_all_courses: true } },
  ])('rejects missing identity, invalid roles, and invented capabilities', (fixture) => {
    expect(instructorAccountSchema.safeParse(fixture).success).toBe(false)
  })

  it.each([
    'tomorrow',
    '2026-09-22',
    '2026-09-22T12:30:45',
    '2026-13-22T12:30:45+00:00',
  ])('rejects invalid login expiry %s', (expires_at) => {
    expect(loginResponseSchema.safeParse({
      expires_at, must_change_password: false,
    }).success).toBe(false)
  })

  it('strictly validates request payloads', () => {
    expect(loginRequestSchema.parse({
      email: 'teacher@ucsc.edu', password: 'TemporaryPass123!',
    })).toEqual({ email: 'teacher@ucsc.edu', password: 'TemporaryPass123!' })
    expect(profilePatchRequestSchema.parse({ display_name: 'Prof. Updated' })).toEqual({
      display_name: 'Prof. Updated',
    })
    expect(passwordChangeRequestSchema.parse({
      current_password: 'TemporaryPass123!', new_password: 'NewPass123!',
    })).toEqual({
      current_password: 'TemporaryPass123!', new_password: 'NewPass123!',
    })

    expect(loginRequestSchema.safeParse({
      email: 'teacher@ucsc.edu', password: 'x', remember_me: true,
    }).success).toBe(false)
    expect(profilePatchRequestSchema.safeParse({}).success).toBe(false)
    expect(profilePatchRequestSchema.safeParse({
      email: 'teacher@example.edu',
    }).success).toBe(false)
    expect(profilePatchRequestSchema.parse({
      email: '  New.Address@UCSC.EDU  ',
    })).toEqual({ email: 'new.address@ucsc.edu' })
    expect(profilePatchRequestSchema.safeParse({
      display_name: 'Prof. Updated', role: 'admin',
    }).success).toBe(false)
    expect(passwordChangeRequestSchema.safeParse({
      current_password: 'old', new_password: 'new', revoke_others: false,
    }).success).toBe(false)
  })

  it('validates current course list and create wire shapes', () => {
    const request = courseCreateRequestSchema.parse({
      course_id: 'cmpm-80h',
      course_name: 'Game Design',
      instructor_name: 'Prof. Test',
      institution_slug: 'ucsc',
    })
    const response = courseCreateResponseSchema.parse({
      status: 'success',
      id: 42,
      course_id: request.course_id,
      course_name: request.course_name,
      institution_slug: request.institution_slug,
      role: 'owner',
    })

    expect(response).toMatchObject({ status: 'success', id: 42, role: 'owner' })
    expect(courseCreateRequestSchema.safeParse({
      ...request, capabilities: ['publish'],
    }).success).toBe(false)
    expect(courseCreateRequestSchema.safeParse({
      ...request, course_id: 'CMPM 80H',
    }).success).toBe(false)
    expect(courseCreateResponseSchema.safeParse({
      ...response, role: 'instructor',
    }).success).toBe(false)
  })

  it('requires a rotated session after password change', () => {
    const rotated = {
      expires_at: '2026-09-24T13:00:00Z',
      must_change_password: false,
    }
    expect(passwordChangeResponseSchema.parse(rotated)).toEqual(rotated)
    expect(passwordChangeResponseSchema.safeParse({ ...rotated, token: 'must-not-be-exposed' }).success).toBe(false)
    expect(passwordChangeResponseSchema.safeParse({ status: 'password_changed' }).success).toBe(false)
    expect(passwordChangeResponseSchema.safeParse({ ...rotated, must_change_password: true }).success).toBe(false)
  })
})
