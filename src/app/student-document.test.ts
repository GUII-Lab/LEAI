import { expect, it } from 'vitest'
import type { StudentSession, StudentSurvey } from '@/api/student'
import { createStudentDraft } from './student-document'
import JSZip from 'jszip'

it('generates a real Word archive from saved student messages', async () => {
  const survey: StudentSurvey = { survey_id: '550e8400-e29b-41d4-a716-446655440010', label: 'Planning Reflection',
    intro: 'Welcome.', available: true, anonymous_matching_enabled: false, completion_certificate_enabled: false, completed_response_download_enabled: true }
  const session: StudentSession = { session_id: '550e8400-e29b-41d4-a716-446655440011', survey_id: survey.survey_id,
    turn_version: 2, status: 'active', prompt: { phase: 'complete' }, progress_label: 'Area 1 of 3 — Planning · Question 1 of 4',
    results: {}, answer_map: { P1: [2] }, messages: [
      { id: 1, sequence: 1, role: 'assistant', content: 'What did you consider?', attribution: { item_id: 'P1' } },
      { id: 2, sequence: 2, role: 'student', content: 'I omitted private data.', attribution: { item_id: 'P1' } },
    ] }
  const blob = await createStudentDraft(survey, session)
  expect(blob.type).toContain('wordprocessingml.document')
  expect(blob.size).toBeGreaterThan(1000)
  expect(Array.from(new Uint8Array(await blob.slice(0, 4).arrayBuffer()))).toEqual([80, 75, 3, 4])
  session.answer_excerpts = { P1: ['I share only the rubric.'] }
  const revised = await createStudentDraft(survey, session)
  const zip = await JSZip.loadAsync(await revised.arrayBuffer())
  const xml = await zip.file('word/document.xml')!.async('string')
  expect(xml).toContain('I share only the rubric.')
  expect(xml).not.toContain('I omitted private data.')
})
