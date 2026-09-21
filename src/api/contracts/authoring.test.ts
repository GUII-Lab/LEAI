import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  activeDraftListSchema,
  activeDraftSchema,
  draftRestoreRequestSchema,
  draftSaveRequestSchema,
  freezeDraftRequestSchema,
  freezeDraftResponseSchema,
  individualPublicationRequestSchema,
  individualPublicationResponseSchema,
  previewCapabilitySchema,
  previewCompleteResponseSchema,
  previewSettingsPatchSchema,
  previewSettingsSchema,
  previewStatusSchema,
  type ActiveDraft,
  type IndividualPublicationResponse,
} from './authoring'

const ids = {
  draft: '550e8400-e29b-41d4-a716-446655440000',
  questionSet: '550e8400-e29b-41d4-a716-446655440001',
  checkpoint: '550e8400-e29b-41d4-a716-446655440002',
  revision: '550e8400-e29b-41d4-a716-446655440003',
} as const

const draftFixture = {
  id: ids.draft,
  question_set_id: ids.questionSet,
  course_id: 'cmpm-80h',
  template_id: '',
  title: 'Weekly Reflection',
  audience: 'individual',
  collection_style: 'guided',
  source_kind: 'blank',
  source_template_revision_id: null,
  workflow_status: 'active',
  body: { schema_version: 'guided-feedback-v2', title: 'Weekly Reflection' },
  version: 2,
  base_revision_id: null,
  current_checkpoint_id: ids.checkpoint,
  updated_at: '2026-09-21T12:30:45.123456+00:00',
} as const

const revisionFixture = {
  id: ids.revision,
  question_set_id: ids.questionSet,
  revision_number: 1,
  source_draft_version: 2,
  content_hash: 'a'.repeat(64),
  compiler_version: '2',
  engine_version: 'formmode-v1',
  preview_completed: false,
  created_at: '2026-09-21T12:31:45.123456+00:00',
} as const

describe('authoring contracts', () => {
  it('parses the current active draft detail/list shape and inferred type', () => {
    const draft = activeDraftSchema.parse(draftFixture)
    const list = activeDraftListSchema.parse({ drafts: [draftFixture] })

    expect(draft.version).toBe(2)
    expect(list.drafts).toHaveLength(1)
    expectTypeOf(draft).toEqualTypeOf<ActiveDraft>()
  })

  it.each([
    { audience: 'team', collection_style: 'open' },
    { audience: 'unknown', collection_style: 'guided' },
    { audience: 'individual', collection_style: 'unknown' },
  ])('rejects unsupported audience/style $audience/$collection_style', (taxonomy) => {
    expect(activeDraftSchema.safeParse({ ...draftFixture, ...taxonomy }).success).toBe(false)
  })

  it('preserves nullable draft identity fields and rejects invalid versions/timestamps', () => {
    expect(activeDraftSchema.parse({
      ...draftFixture,
      base_revision_id: ids.revision,
      current_checkpoint_id: null,
    }).current_checkpoint_id).toBeNull()
    expect(activeDraftSchema.safeParse({ ...draftFixture, version: 1.5 }).success).toBe(false)
    expect(activeDraftSchema.safeParse({ ...draftFixture, updated_at: 'tomorrow' }).success).toBe(false)
  })

  it('strictly validates idempotent draft save and restore requests', () => {
    const save = draftSaveRequestSchema.parse({
      expected_version: 2,
      body: draftFixture.body,
      idempotency_key: 'autosave-version-2',
      checkpoint_reason: 'preview',
    })
    const restore = draftRestoreRequestSchema.parse({
      expected_version: 2,
      version_id: ids.checkpoint,
      idempotency_key: 'restore-version-1',
    })

    expect(save.checkpoint_reason).toBe('preview')
    expect(restore.version_id).toBe(ids.checkpoint)
    expect(draftSaveRequestSchema.safeParse({
      expected_version: 2, idempotency_key: 'autosave-version-2',
    }).success).toBe(false)
    expect(draftSaveRequestSchema.safeParse({
      expected_version: 2.5, body: {}, idempotency_key: 'autosave-version-2',
    }).success).toBe(false)
    expect(draftRestoreRequestSchema.safeParse({
      ...restore, team_configuration_id: 5,
    }).success).toBe(false)
  })

  it('requires immutable revision identity and positive integer version numbers', () => {
    const response = freezeDraftResponseSchema.parse({ revision: revisionFixture })
    expect(response.revision.id).toBe(ids.revision)
    expect(freezeDraftRequestSchema.parse({ expected_version: 2 })).toEqual({
      expected_version: 2,
    })
    expect(freezeDraftResponseSchema.safeParse({
      revision: { ...revisionFixture, id: undefined },
    }).success).toBe(false)
    expect(freezeDraftResponseSchema.safeParse({
      revision: { ...revisionFixture, revision_number: 1.5 },
    }).success).toBe(false)
  })

  it('parses preview capability timing, status, and settings', () => {
    const capability = previewCapabilitySchema.parse({
      token: 'raw-preview-token',
      expires_at: '2026-09-22T12:31:45.123456+00:00',
      ready_at: '2026-09-21T12:31:47.123456+00:00',
      preview_url: 'feedback.html?preview=raw-preview-token',
      completion_certificate_enabled: true,
      parsed_document_download_enabled: false,
      preview_completed: false,
      preview_skipped: false,
    })

    expect(capability.preview_completed).toBe(false)
    expect(previewSettingsSchema.parse({
      completion_certificate_enabled: true,
      parsed_document_download_enabled: false,
    })).toEqual({
      completion_certificate_enabled: true,
      parsed_document_download_enabled: false,
    })
    expect(previewStatusSchema.parse({
      preview_completed: false, preview_skipped: true,
    }).preview_skipped).toBe(true)
  })

  it('rejects invalid preview timing and empty/unknown settings patches', () => {
    expect(previewCapabilitySchema.safeParse({
      token: 'raw-preview-token',
      expires_at: 'tomorrow',
      ready_at: 'later',
      preview_url: 'feedback.html?preview=raw-preview-token',
      completion_certificate_enabled: true,
      parsed_document_download_enabled: false,
      preview_completed: false,
      preview_skipped: false,
    }).success).toBe(false)
    expect(previewCapabilitySchema.safeParse({
      token: 'raw-preview-token',
      expires_at: '2026-09-21T12:31:45+00:00',
      ready_at: '2026-09-21T12:31:46+00:00',
      preview_url: 'feedback.html?preview=raw-preview-token',
      completion_certificate_enabled: true,
      parsed_document_download_enabled: false,
      preview_completed: false,
      preview_skipped: false,
    }).success).toBe(false)
    expect(previewSettingsPatchSchema.safeParse({}).success).toBe(false)
    expect(previewSettingsPatchSchema.safeParse({
      completion_certificate_enabled: true, transcript_logging: true,
    }).success).toBe(false)
  })

  it('parses authoritative preview completion evidence', () => {
    expect(previewCompleteResponseSchema.parse({
      completed: true,
      completed_at: '2026-09-21T12:35:45.123456+00:00',
      question_set_revision_id: ids.revision,
    }).question_set_revision_id).toBe(ids.revision)
  })

  it('accepts only normalized Individual publication requests', () => {
    const request = individualPublicationRequestSchema.parse({
      course_id: 'cmpm-80h',
      idempotency_key: 'publish-guided-v12',
      survey_label: 'Weekly Reflection',
      week_number: null,
      opens_at: null,
      expires_at: null,
      preview_token: 'raw-preview-token',
    })

    expect(request.week_number).toBeNull()
    expect(individualPublicationRequestSchema.safeParse({
      ...request, team_configuration_id: 9,
    }).success).toBe(false)
    expect(individualPublicationRequestSchema.safeParse({
      ...request,
      opens_at: '2026-10-02T12:00:00+00:00',
      expires_at: '2026-10-01T12:00:00+00:00',
    }).success).toBe(false)
    expect(individualPublicationRequestSchema.safeParse({
      ...request,
      opens_at: '2026-10-01T10:00:00-07:00',
      expires_at: '2026-10-01T16:00:00+00:00',
    }).success).toBe(false)
  })

  it('parses only Individual publication responses with explicit nullable fields', () => {
    const result = individualPublicationResponseSchema.parse({
      id: 42,
      public_id: 'd84us8800m',
      name: 'Weekly Reflection',
      survey_label: 'Weekly Reflection',
      mode: 'form',
      question_set_revision_id: ids.revision,
      direct_url: 'feedback.html?id=d84us8800m',
      opens_at: null,
      expires_at: null,
      completion_certificate_enabled: true,
      parsed_document_download_enabled: false,
      team_configuration_id: null,
    })

    expectTypeOf(result).toEqualTypeOf<IndividualPublicationResponse>()
    expect(result.team_configuration_id).toBeNull()
    expect(individualPublicationResponseSchema.safeParse({
      ...result, mode: 'group', team_configuration_id: 9,
    }).success).toBe(false)
    expect(individualPublicationResponseSchema.safeParse({
      ...result, question_set_revision_id: undefined,
    }).success).toBe(false)
  })
})
