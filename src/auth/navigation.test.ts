import { expect, it } from 'vitest'
import { getEnvironment } from '@/config/environment'
import { loginHref, safeInstructorDestination } from './navigation'

const local = getEnvironment({})
const qa = { ...local, name: 'qa' as const, appBasePath: '/LEAI/qa/' }

it('keeps a protected return path inside the active app deployment', () => {
  expect(safeInstructorDestination(qa, '/LEAI/qa/FeedbackAnalyzer.html'))
    .toBe('/LEAI/qa/FeedbackAnalyzer.html')
  expect(loginHref(qa, '/LEAI/qa/FeedbackAnalyzer.html'))
    .toBe('/LEAI/qa/InstructorLogin.html?next=%2FLEAI%2Fqa%2FFeedbackAnalyzer.html')
})

const citedResponse = '/LEAI/qa/FeedbackAnalyzer.html?course_id=11111111-1111-4111-8111-111111111111&occurrence_id=22222222-2222-4222-8222-222222222222&response_id=33333333-3333-4333-8333-333333333333&response_message_id=55'

it('preserves an authorized cited-response return path through sign-in', () => {
  expect(safeInstructorDestination(qa, citedResponse)).toBe(citedResponse)
  const login = loginHref(qa, citedResponse)
  expect(new URL(login, 'https://leai.example').searchParams.get('next')).toBe(citedResponse)
})

it('preserves only the supported internal Chat and account views', () => {
  const chat = '/LEAI/qa/FeedbackChat.html?course_id=11111111-1111-4111-8111-111111111111&chat_id=22222222-2222-4222-8222-222222222222'
  expect(safeInstructorDestination(qa, chat)).toBe(chat)
  expect(safeInstructorDestination(qa, '/LEAI/qa/InstructorHome.html?view=account'))
    .toBe('/LEAI/qa/InstructorHome.html?view=account')
})

it.each([
  '/LEAI/qa/FeedbackAnalyzer.html?course_id=11111111-1111-4111-8111-111111111111&redirect=https://evil.example/',
  '/LEAI/qa/FeedbackAnalyzer.html?course_id=bad',
  '/LEAI/qa/FeedbackAnalyzer.html?course_id=11111111-1111-4111-8111-111111111111&course_id=22222222-2222-4222-8222-222222222222',
  'https://evil.example/',
  '//evil.example/',
  '/LEAI/FeedbackAnalyzer.html',
  '/LEAI/qa/../FeedbackAnalyzer.html',
  '/LEAI/qa/feedback.html',
  '/LEAI/qa/InstructorLogin.html',
  '/LEAI/qa/FeedbackAnalyzer.html?redirect=https://evil.example/',
])('rejects an unsafe or unrelated return target %s', (candidate) => {
  expect(safeInstructorDestination(qa, candidate)).toBe('/LEAI/qa/InstructorHome.html')
})
