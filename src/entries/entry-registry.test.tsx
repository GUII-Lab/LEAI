import { expect, it } from 'vitest'
import { entryNames, getEntry } from './entry-registry'

it('maps every real HTML entry to an application page', () => {
  expect(entryNames).toEqual([
    'InstructorHome',
    'PromptDesigner',
    'FeedbackAnalyzer',
    'FeedbackChat',
    'CourseBanner',
    'Customizations',
    'feedback',
  ])

  for (const entryName of entryNames) {
    expect(getEntry(entryName).pageTitle).not.toHaveLength(0)
  }
})

it('fails visibly for an unknown entry instead of mounting the wrong page', () => {
  expect(() => getEntry('unknown')).toThrow('LEAI entry configuration error')
})
