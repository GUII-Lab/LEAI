import { expect, it } from 'vitest'
import {
  analysisOverviewResponseSchema,
  analysisNgramsResponseSchema,
  analysisProgressResponseSchema,
  analysisResponsesResponseSchema,
  analysisSettingsRequestSchema,
  analysisSettingsResponseSchema,
  certificateVerificationRequestSchema,
  certificateVerificationResponseSchema,
} from './feedback-analyzer'

const occurrenceId = '550e8400-e29b-41d4-a716-446655440000'
const responseId = '550e8400-e29b-41d4-a716-446655440001'

const metrics = {
  response_count: 1,
  student_turn_count: 2,
  pdf_response_count: 0,
  average_words: 12,
  participation: { state: 'unavailable', reason: 'eligible_denominator_missing' },
  turn_distribution: { state: 'unavailable', reason: 'insufficient_occurrences' },
  question_health: { state: 'unavailable', reason: 'exact_structured_identifiers_unavailable' },
}

it('parses explicit Analyzer overview metrics and exact occurrence scope', () => {
  const parsed = analysisOverviewResponseSchema.parse({
    course: { id: occurrenceId, name: 'Demo course' },
    selected_occurrence_ids: [occurrenceId],
    occurrences: [{
      id: occurrenceId,
      label: 'Week 1 reflection',
      mode: 'structured',
      audience: 'individual',
      collection_style: 'guided',
      completion_certificate_enabled: true,
      schema_family_id: occurrenceId,
      created_at: '2026-09-27T12:00:00Z',
      metrics,
    }],
    summary: metrics,
    team_surveys: [],
  })
  expect(parsed.summary.response_count).toBe(1)
  expect(parsed.summary.student_turn_count).toBe(2)
  expect(parsed.summary.participation.state).toBe('unavailable')
  expect(parsed.occurrences[0].completion_certificate_enabled).toBe(true)
})

it('parses bounded n-gram metrics with a nullable cutoff and supports response term filters', () => {
  expect(analysisNgramsResponseSchema.parse({
    source_count: 2,
    cutoff_at: null,
    keyness_available: false,
    items: [{ term: 'peer review', count: 2, keyness: null }],
  }).items[0].term).toBe('peer review')
  expect(analysisNgramsResponseSchema.safeParse({
    source_count: -1,
    cutoff_at: null,
    keyness_available: false,
    items: [],
  }).success).toBe(false)
  expect(analysisResponsesResponseSchema.safeParse({
    results: [], has_more: false, next_cursor: null, term: 'peer review',
  }).success).toBe(false)
})

it('keeps one response record distinct from its multiple student turns and rejects private signal fields', () => {
  const response = {
    kind: 'chat',
    response_id: responseId,
    label: 'R1',
    survey_label: 'Week 1 reflection',
    created_at: '2026-09-27T12:00:00Z',
    nudged: false,
    response_href: `#response=${responseId}`,
    transcript: [{ message_id: 'm1', content: 'An answer', timestamp: '2026-09-27T12:00:00Z' }],
    answers: [],
    occurrence_id: occurrenceId,
    team_snapshot_id: null,
    team_snapshot_item_id: null,
    team_label: null,
    team_configuration_label: null,
    source: 'student',
  }
  expect(analysisResponsesResponseSchema.parse({
    results: [response], has_more: false, next_cursor: null,
  }).results[0].response_id).toBe(responseId)
  expect(analysisResponsesResponseSchema.safeParse({
    results: [{ ...response, device_key_digest: 'a'.repeat(64) }],
    has_more: false,
    next_cursor: null,
  }).success).toBe(false)
})

it('parses anonymous progress and rejects anything beyond labels and confidence', () => {
  const progress = {
    state: 'available',
    occurrences: [{ id: occurrenceId, label: 'Week 1' }],
    students: [{ label: 'S1', match_confidence: 'high', responses_by_occurrence: { [occurrenceId]: 1 } }],
    groups: [{ label: 'G1', team_snapshot_id: '4,9', team_snapshot_label: 'Winter · Team Red', responses_by_occurrence: { [occurrenceId]: 2 } }],
    unlinked_by_occurrence: [{ occurrence_id: occurrenceId, response_count: 1 }],
  }
  expect(analysisProgressResponseSchema.parse(progress).students[0].label).toBe('S1')
  expect(analysisProgressResponseSchema.safeParse({
    ...progress,
    students: [{ ...progress.students[0], fingerprint_digest: 'a'.repeat(64) }],
  }).success).toBe(false)
})

it('parses disabled matching and validates versioned settings changes strictly', () => {
  expect(analysisProgressResponseSchema.parse({
    state: 'unavailable',
    reason: 'matching_disabled',
    occurrences: [],
    students: [],
    groups: [],
    unlinked_by_occurrence: [],
  }).state).toBe('unavailable')
  expect(analysisSettingsResponseSchema.parse({
    anonymous_matching_enabled: false,
    settings_version: 1,
  }).settings_version).toBe(1)
  expect(analysisSettingsRequestSchema.parse({
    anonymous_matching_enabled: true,
    expected_settings_version: 1,
  }).anonymous_matching_enabled).toBe(true)
  expect(analysisSettingsRequestSchema.safeParse({
    anonymous_matching_enabled: true,
    expected_settings_version: 1,
    device_key: 'not-a-setting',
  }).success).toBe(false)
})

it('validates bounded certificate verification requests and positional boolean results', () => {
  expect(certificateVerificationRequestSchema.parse({
    occurrence_id: occurrenceId,
    codes: ['abcd-efgh-jklm-npqr'],
  }).codes).toHaveLength(1)
  expect(certificateVerificationRequestSchema.safeParse({ occurrence_id: occurrenceId, codes: [] }).success).toBe(false)
  expect(certificateVerificationRequestSchema.safeParse({ occurrence_id: occurrenceId, codes: ['code'.repeat(17)] }).success).toBe(false)
  expect(certificateVerificationRequestSchema.safeParse({ occurrence_id: occurrenceId, codes: Array.from({ length: 101 }, () => 'code') }).success).toBe(false)
  expect(certificateVerificationResponseSchema.parse({ results: [true, false, true] }).results).toEqual([true, false, true])
  expect(certificateVerificationResponseSchema.safeParse({ results: [true], codes: ['private'] }).success).toBe(false)
})
