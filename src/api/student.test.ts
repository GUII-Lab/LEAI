import { expect, it, vi } from 'vitest'
import { getEnvironment } from '@/config/environment'
import { createStudentApi } from './student'

const surveyId = '550e8400-e29b-41d4-a716-446655440010'
const sessionId = '550e8400-e29b-41d4-a716-446655440011'
const token = 'a'.repeat(64)
const prompt = {
  item_id: 'P1', phase: 'rating',
  text: 'I think about how to give the most appropriate information to the AI.',
  wording: 'exact',
  choices: [{ value: 1, label: 'Strongly disagree' }, { value: 5, label: 'Strongly agree' }],
}

it('starts an anonymous survey and sends the capability only to session endpoints', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ survey_id: surveyId, label: 'Reflection', intro: 'Hello', available: true,
      completion_certificate_enabled: false, completed_response_download_enabled: false }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: sessionId, survey_id: surveyId, turn_version: 1, status: 'active', prompt, progress_label: 'Area 1 of 3 — Planning · Question 1 of 4', results: {}, messages: [], token }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: sessionId, survey_id: surveyId, turn_version: 1, status: 'active', prompt, progress_label: 'Area 1 of 3 — Planning · Question 1 of 4', results: {}, messages: [] }), { status: 200 }))
  const api = createStudentApi(getEnvironment({}), () => true, fetcher)

  expect((await api.survey(surveyId)).intro).toBe('Hello')
  expect((await api.start(surveyId, { terms_consent: true, research_consent: false })).token).toBe(token)
  expect((await api.session(surveyId, sessionId, token)).prompt.phase).toBe('rating')
  expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false)
  expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe(`Bearer ${token}`)
  expect(JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string)).toEqual({ terms_consent: true, research_consent: false })
})

it('submits an explicit Likert value with the expected turn version', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    session_id: sessionId, survey_id: surveyId, turn_version: 2, status: 'active',
    progress_label: 'Area 1 of 3 — Planning · Question 1 of 4',
    prompt: { item_id: 'P1', phase: 'reflection', text: 'Why?', wording: 'adaptive', choices: null },
    results: { P1: { rating: 4, status: 'active', probes: 0 } }, messages: [],
  }), { status: 200 }))
  const api = createStudentApi(getEnvironment({}), () => true, fetcher)
  const result = await api.turn(surveyId, sessionId, token, {
    expected_version: 1, item_id: 'P1', kind: 'rating', value: 4,
  })

  expect(result.results.P1?.rating).toBe(4)
  expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
    expected_version: 1, item_id: 'P1', kind: 'rating', value: 4,
  })
})

it('loads debug access and debug snapshots with the separate Researcher cookie session', async () => {
  const snapshot = {
    session_id: sessionId, turn_version: 2,
    schema_state: { item_index: 0, phase: 'probe',
      results: { P1: { rating: null, status: 'active', probes: 1 } },
      evidence_seen: { P1: true, P2: true }, coverage_seen: { P1: ['decision_process'] } },
    responses: [{ sequence: 3, item_id: 'P1', phase: 'answer', kind: 'text', content: 'I check context.',
      evidence_for: ['P1', 'P2'], covered_targets: ['decision_process'], next_item_id: 'P1', next_phase: 'probe' },
    { sequence: 5, item_id: 'P1', phase: 'answer', kind: 'clarification', content: 'Here is an example.',
      evidence_for: [], covered_targets: [], next_item_id: 'P1', next_phase: 'answer' }],
  }
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(snapshot), { status: 200 }))
  const api = createStudentApi(getEnvironment({}), () => true, fetcher)
  await expect(api.debugAccess(surveyId)).resolves.toEqual({ enabled: true })
  const actual = await api.debug(surveyId, sessionId)
  expect(actual.schema_state.coverage_seen.P1).toEqual(['decision_process'])
  expect(actual.responses[0]?.next_item_id).toBe('P1')
  expect(actual.responses[1]?.kind).toBe('clarification')
  expect(String(fetcher.mock.calls[0]?.[0])).toContain(`/surveys/${surveyId}/debug-access/`)
  expect(String(fetcher.mock.calls[1]?.[0])).toContain(`/surveys/${surveyId}/sessions/${sessionId}/debug/`)
  expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization')).toBeNull()
  expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('Authorization')).toBeNull()
  expect(fetcher.mock.calls.every(([, init]) => init?.credentials === 'same-origin')).toBe(true)
  expect(fetcher.mock.calls[1]?.[1]?.method ?? 'GET').toBe('GET')
})

it('freezes a completed-question session only via the final-download endpoint', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    session_id: sessionId, survey_id: surveyId, turn_version: 4, status: 'completed',
    progress_label: 'Reflection complete', prompt: { phase: 'complete' },
    results: { P1: { rating: null, status: 'answered', probes: 0 } },
    answer_map: { P1: [3] }, messages: [],
  }), { status: 200 }))
  const api = createStudentApi(getEnvironment({}), () => true, fetcher)
  const frozen = await api.finalize(surveyId, sessionId, token, 3)
  expect(frozen.status).toBe('completed')
  expect(frozen.answer_map.P1).toEqual([3])
  expect(String(fetcher.mock.calls[0]?.[0])).toContain('/finalize/')
  expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({ expected_version: 3 })
  expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(`Bearer ${token}`)
})
