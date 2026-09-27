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

it.each([
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
